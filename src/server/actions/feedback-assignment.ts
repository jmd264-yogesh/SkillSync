"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { createAssignmentSchema } from "@/validations/feedback.schema";

export async function getMyAssignments() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (!session.user.employeeId) throw new ForbiddenError();

  return db.feedbackFormAssignment.findMany({
    where: {
      reviewerId: session.user.employeeId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    include: {
      form: {
        include: {
          sections: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
        },
      },
      employee: { select: { id: true, name: true, employeeCode: true, designation: { select: { name: true } } } },
      project: { select: { id: true, name: true } },
      reviewCycle: { select: { id: true, name: true, status: true } },
      submission: { select: { id: true, submittedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAssignment(id: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (!session.user.employeeId) throw new ForbiddenError();

  const assignment = await db.feedbackFormAssignment.findUnique({
    where: { id },
    include: {
      form: {
        include: {
          sections: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
        },
      },
      employee: { select: { id: true, name: true, employeeCode: true, designation: { select: { name: true } } } },
      project: { select: { id: true, name: true } },
      reviewCycle: { select: { id: true, name: true, status: true } },
      submission: {
        include: { responses: true },
      },
    },
  });
  if (!assignment) throw new NotFoundError("Assignment");

  // Only the reviewer can see their assignment
  const isAdmin = session.user.role === "ADMIN";
  const isReviewer = assignment.reviewerId === session.user.employeeId;
  if (!isAdmin && !isReviewer) throw new ForbiddenError();

  return assignment;
}

export async function getTeamAssignmentStatus(cycleId?: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "MANAGER") throw new ForbiddenError();
  if (!session.user.employeeId) throw new ForbiddenError();

  // Get CDM's direct reportees
  const reportees = await db.employee.findMany({
    where: { managerId: session.user.employeeId },
    select: { id: true },
  });
  const reporteeIds = reportees.map((r) => r.id);

  const where: Record<string, unknown> = { employeeId: { in: reporteeIds } };
  if (cycleId) where.reviewCycleId = cycleId;

  return db.feedbackFormAssignment.findMany({
    where,
    include: {
      form: { select: { formType: true, title: true } },
      employee: { select: { id: true, name: true, employeeCode: true, designation: { select: { name: true } } } },
      reviewer: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      reviewCycle: { select: { id: true, name: true } },
      submission: { select: { id: true, submittedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createAssignment(data: unknown) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const isAdmin = session.user.role === "ADMIN";
  const isManager = session.user.role === "MANAGER";
  if (!isAdmin && !isManager) throw new ForbiddenError();

  const parsed = createAssignmentSchema.safeParse(data);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

  const { reviewCycleId, formId, reviewerId, employeeId, projectId, dueDate } = parsed.data;

  // Validate cycle is active
  const cycle = await db.reviewCycle.findUnique({ where: { id: reviewCycleId } });
  if (!cycle) throw new NotFoundError("Review cycle");
  if (cycle.status !== "ACTIVE" && cycle.status !== "DRAFT") {
    throw new ValidationError("Assignments can only be created for active or draft cycles");
  }

  // Validate form belongs to this cycle
  const form = await db.feedbackForm.findUnique({ where: { id: formId } });
  if (!form || form.reviewCycleId !== reviewCycleId) throw new NotFoundError("Feedback form");

  // Manager scope: can only assign for their direct reportees
  if (isManager && session.user.employeeId) {
    const reportees = await db.employee.findMany({
      where: { managerId: session.user.employeeId },
      select: { id: true },
    });
    const reporteeIds = new Set(reportees.map((r) => r.id));
    if (!reporteeIds.has(employeeId)) throw new ForbiddenError("Employee is not in your team");
  }

  // For PM_FEEDBACK: validate reviewer is actually the PM on the given project
  if (form.formType === "PM_FEEDBACK" && projectId) {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError("Project");
    if (project.projectManagerId !== reviewerId) {
      throw new ValidationError("Reviewer must be the project manager for PM feedback");
    }
    // Employee must be allocated to that project
    const allocation = await db.projectAllocation.findUnique({
      where: { projectId_employeeId: { projectId, employeeId } },
    });
    if (!allocation) throw new ValidationError("Employee is not allocated to this project");
  }

  // Check for duplicate
  const existing = await db.feedbackFormAssignment.findFirst({
    where: { reviewCycleId, formId, reviewerId, employeeId, projectId: projectId ?? null },
  });
  if (existing) throw new ValidationError("This assignment already exists");

  const assignment = await db.feedbackFormAssignment.create({
    data: {
      reviewCycleId,
      formId,
      reviewerId,
      employeeId,
      projectId,
      assignedById: session.user.id,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    },
  });

  revalidatePath("/manager/feedback/assign");
  revalidatePath(`/admin/feedback/cycles/${reviewCycleId}`);
  return assignment;
}

export async function deleteAssignment(id: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const assignment = await db.feedbackFormAssignment.findUnique({
    where: { id },
    include: { submission: { select: { id: true } } },
  });
  if (!assignment) throw new NotFoundError("Assignment");

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin) throw new ForbiddenError();

  if (assignment.submission) throw new ValidationError("Cannot delete an assignment that has been submitted");

  await db.feedbackFormAssignment.delete({ where: { id } });
  revalidatePath(`/admin/feedback/cycles/${assignment.reviewCycleId}`);
  return { success: true };
}

// Returns all employees + managers needed to build the assignment UI
export async function getAssignmentContext(cycleId: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const isAdmin = session.user.role === "ADMIN";
  const isManager = session.user.role === "MANAGER";
  if (!isAdmin && !isManager) throw new ForbiddenError();

  const [cycle, forms, employees, projects] = await Promise.all([
    db.reviewCycle.findUnique({ where: { id: cycleId }, select: { id: true, name: true, status: true } }),
    db.feedbackForm.findMany({
      where: {
        reviewCycleId: cycleId,
        ...(isManager ? { createdById: session.user.id } : {}),
      },
      select: { id: true, title: true, formType: true },
    }),
    isManager && session.user.employeeId
      ? db.employee.findMany({
          where: { managerId: session.user.employeeId },
          select: { id: true, name: true, employeeCode: true, designation: { select: { name: true } } },
          orderBy: { name: "asc" },
        })
      : db.employee.findMany({
          select: { id: true, name: true, employeeCode: true, designation: { select: { name: true } } },
          orderBy: { name: "asc" },
        }),
    db.project.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, projectManagerId: true, projectManager: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!cycle) throw new NotFoundError("Review cycle");

  return { cycle, forms, employees, projects };
}
