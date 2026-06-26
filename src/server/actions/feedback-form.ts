"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { createFeedbackFormSchema } from "@/validations/feedback.schema";

export async function getFeedbackFormsForCycle(cycleId: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const isAdmin = session.user.role === "ADMIN";
  const isManager = session.user.role === "MANAGER";
  if (!isAdmin && !isManager) throw new ForbiddenError();

  const where = isAdmin
    ? { reviewCycleId: cycleId }
    : { reviewCycleId: cycleId, createdById: session.user.id };

  return db.feedbackForm.findMany({
    where,
    include: {
      sections: {
        include: { questions: { orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      },
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFeedbackForm(id: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const form = await db.feedbackForm.findUnique({
    where: { id },
    include: {
      sections: {
        include: { questions: { orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      },
      reviewCycle: { select: { id: true, name: true, status: true } },
    },
  });
  if (!form) throw new NotFoundError("Feedback form");

  const isAdmin = session.user.role === "ADMIN";
  const isCreator = form.createdById === session.user.id;
  if (!isAdmin && !isCreator) throw new ForbiddenError();

  return form;
}

export async function createFeedbackForm(data: unknown) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const isAdmin = session.user.role === "ADMIN";
  const isManager = session.user.role === "MANAGER";
  if (!isAdmin && !isManager) throw new ForbiddenError();

  const parsed = createFeedbackFormSchema.safeParse(data);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

  const { title, description, formType, reviewCycleId, sections } = parsed.data;

  // Managers can only create PM_FEEDBACK forms
  if (isManager && formType !== "PM_FEEDBACK") {
    throw new ForbiddenError("Managers can only create PM feedback forms");
  }

  const cycle = await db.reviewCycle.findUnique({ where: { id: reviewCycleId } });
  if (!cycle) throw new NotFoundError("Review cycle");
  if (cycle.status === "CLOSED" || cycle.status === "ARCHIVED") {
    throw new ValidationError("Cannot add forms to a closed or archived cycle");
  }

  const form = await db.feedbackForm.create({
    data: {
      title,
      description,
      formType,
      reviewCycleId,
      createdById: session.user.id,
      sections: {
        create: sections.map((section) => ({
          title: section.title,
          description: section.description,
          order: section.order,
          questions: {
            create: section.questions.map((q) => ({
              text: q.text,
              type: q.type,
              required: q.required,
              order: q.order,
            })),
          },
        })),
      },
    },
    include: {
      sections: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
    },
  });

  revalidatePath(`/admin/feedback/cycles/${reviewCycleId}/forms`);
  revalidatePath(`/manager/feedback/forms`);
  return form;
}

export async function deleteFeedbackForm(id: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const form = await db.feedbackForm.findUnique({
    where: { id },
    include: { _count: { select: { assignments: true } } },
  });
  if (!form) throw new NotFoundError("Feedback form");

  const isAdmin = session.user.role === "ADMIN";
  const isCreator = form.createdById === session.user.id;
  if (!isAdmin && !isCreator) throw new ForbiddenError();

  if (form._count.assignments > 0) {
    throw new ValidationError("Cannot delete a form that has been assigned");
  }

  await db.feedbackForm.delete({ where: { id } });

  revalidatePath(`/admin/feedback/cycles/${form.reviewCycleId}/forms`);
  revalidatePath("/manager/feedback/forms");
  return { success: true };
}
