"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { submitFeedbackSchema, generateSummarySchema } from "@/validations/feedback.schema";
import { computeReadiness } from "@/server/services/readiness.service";
import type { Prisma } from "@prisma/client";

export async function submitFeedback(data: unknown) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (!session.user.employeeId) throw new ForbiddenError();

  const parsed = submitFeedbackSchema.safeParse(data);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

  const { assignmentId, responses } = parsed.data;

  const assignment = await db.feedbackFormAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      form: { include: { sections: { include: { questions: true } } } },
      reviewCycle: { select: { status: true } },
      submission: { select: { id: true } },
    },
  });
  if (!assignment) throw new NotFoundError("Assignment");
  if (assignment.reviewerId !== session.user.employeeId) throw new ForbiddenError();
  if (assignment.reviewCycle.status === "CLOSED" || assignment.reviewCycle.status === "ARCHIVED") {
    throw new ValidationError("This review cycle is closed");
  }
  if (assignment.submission) throw new ValidationError("This assignment has already been submitted");

  // Validate all required questions are answered
  const allQuestions = assignment.form.sections.flatMap((s) => s.questions);
  const requiredQuestions = allQuestions.filter((q) => q.required);
  const answeredIds = new Set(
    responses
      .filter((r) => r.ratingValue !== undefined || (r.textValue !== undefined && r.textValue.trim() !== ""))
      .map((r) => r.questionId)
  );
  for (const q of requiredQuestions) {
    if (!answeredIds.has(q.id)) {
      throw new ValidationError(`Required question not answered: ${q.text}`);
    }
  }

  // Validate rating values are in range
  for (const r of responses) {
    if (r.ratingValue !== undefined && (r.ratingValue < 1 || r.ratingValue > 5)) {
      throw new ValidationError("Rating values must be between 1 and 5");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.feedbackSubmission.create({
      data: {
        assignmentId,
        submittedAt: new Date(),
        responses: {
          create: responses
            .filter((r) => r.ratingValue !== undefined || r.textValue !== undefined)
            .map((r) => ({
              questionId: r.questionId,
              ratingValue: r.ratingValue,
              textValue: r.textValue,
            })),
        },
      },
    });

    await tx.feedbackFormAssignment.update({
      where: { id: assignmentId },
      data: { status: "SUBMITTED" },
    });
  });

  revalidatePath("/manager/feedback");
  revalidatePath(`/manager/feedback/submit/${assignmentId}`);
  revalidatePath(`/manager/feedback/team`);
  return { success: true };
}

// Scope-aware: returns all feedback an authorized viewer can see for an employee in a cycle
export async function getEmployeeFeedback(employeeId: string, cycleId: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const isAdmin = session.user.role === "ADMIN";
  const isManager = session.user.role === "MANAGER";
  if (!isAdmin && !isManager) throw new ForbiddenError();

  // Manager scope: can only see feedback for their direct reportees
  if (isManager && session.user.employeeId) {
    const reportees = await db.employee.findMany({
      where: { managerId: session.user.employeeId },
      select: { id: true },
    });
    if (!reportees.some((r) => r.id === employeeId)) throw new ForbiddenError();
  }

  // Admins see all; Managers see PM_FEEDBACK + CDM_ASSESSMENT (not HR_FEEDBACK)
  const where: Prisma.FeedbackFormAssignmentWhereInput = {
    employeeId,
    reviewCycleId: cycleId,
    status: "SUBMITTED",
  };
  if (!isAdmin) {
    where.form = { formType: { in: ["PM_FEEDBACK", "CDM_ASSESSMENT"] } };
  }

  const assignments = await db.feedbackFormAssignment.findMany({
    where,
    include: {
      form: { select: { title: true, formType: true, sections: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } } },
      reviewer: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      submission: {
        include: { responses: { include: { question: { select: { text: true, type: true } } } } },
      },
    },
  });

  return assignments;
}

export async function generateFeedbackSummary(data: unknown) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const parsed = generateSummarySchema.safeParse(data);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

  const { reviewCycleId, employeeId, promotionNotes } = parsed.data;

  // Gather all submitted feedback for this employee in this cycle
  const assignments = await db.feedbackFormAssignment.findMany({
    where: { reviewCycleId, employeeId, status: "SUBMITTED" },
    include: {
      submission: { include: { responses: true } },
      form: { include: { sections: { include: { questions: true } } } },
    },
  });

  if (assignments.length === 0) {
    throw new ValidationError("No submitted feedback found for this employee in this cycle");
  }

  // Compute feedback readiness score from RATING responses
  const allRatings = assignments.flatMap((a) =>
    (a.submission?.responses ?? []).filter((r) => r.ratingValue !== null).map((r) => r.ratingValue as number)
  );
  const feedbackReadiness = allRatings.length > 0
    ? Math.round((allRatings.reduce((sum, v) => sum + v, 0) / allRatings.length / 5) * 100)
    : 0;

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: {
      coe: { include: { coeSkills: true } },
      designation: { include: { designationSkills: true } },
      employeeSkills: { where: { status: "APPROVED" } },
    },
  });
  if (!employee) throw new NotFoundError("Employee");

  const { percentage: skillReadiness } = computeReadiness(
    employee.coe?.coeSkills ?? [],
    employee.designation?.designationSkills ?? [],
    employee.employeeSkills,
  );

  // Composite score (50/50 weighting)
  const compositeScore = Math.round((skillReadiness + feedbackReadiness) / 2);

  const promotionStatus =
    compositeScore >= 85 ? "READY_FOR_PROMOTION" :
    compositeScore >= 65 ? "NEAR_READY" :
    compositeScore >= 40 ? "NEEDS_DEVELOPMENT" :
    "NOT_ELIGIBLE_YET";

  // Build text summaries from TEXT responses
  const textResponses = assignments.flatMap((a) =>
    (a.submission?.responses ?? []).filter((r) => r.textValue).map((r) => r.textValue as string)
  );
  const keyStrengths = textResponses.slice(0, 3).join(" | ") || "Based on rating feedback.";
  const developmentAreas = textResponses.slice(3, 6).join(" | ") || "See individual feedback responses.";
  const summaryText = `Composite score: ${compositeScore}% (Skill: ${skillReadiness}%, Feedback: ${feedbackReadiness}%). Based on ${assignments.length} feedback submissions.`;

  const summary = await db.feedbackSummary.upsert({
    where: { reviewCycleId_employeeId: { reviewCycleId, employeeId } },
    create: {
      reviewCycleId,
      employeeId,
      generatedAt: new Date(),
      summaryText,
      keyStrengths,
      developmentAreas,
      skillReadiness,
      feedbackReadiness,
      compositeScore,
      promotionStatus,
      promotionNotes,
    },
    update: {
      generatedAt: new Date(),
      summaryText,
      keyStrengths,
      developmentAreas,
      skillReadiness,
      feedbackReadiness,
      compositeScore,
      promotionStatus,
      promotionNotes,
    },
  });

  revalidatePath(`/admin/feedback/cycles/${reviewCycleId}`);
  revalidatePath(`/admin/feedback/cycles/${reviewCycleId}/employee/${employeeId}`);
  return summary;
}

export async function getEmployeeSummary(employeeId: string, cycleId: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const isAdmin = session.user.role === "ADMIN";
  const isManager = session.user.role === "MANAGER";
  if (!isAdmin && !isManager) throw new ForbiddenError();

  if (isManager && session.user.employeeId) {
    const reportees = await db.employee.findMany({
      where: { managerId: session.user.employeeId },
      select: { id: true },
    });
    if (!reportees.some((r) => r.id === employeeId)) throw new ForbiddenError();
  }

  return db.feedbackSummary.findUnique({
    where: { reviewCycleId_employeeId: { reviewCycleId: cycleId, employeeId } },
    include: { reviewCycle: { select: { name: true, status: true } } },
  });
}
