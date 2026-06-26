"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { createReviewCycleSchema, updateReviewCycleSchema } from "@/validations/feedback.schema";
import type { ReviewCycleStatus } from "@prisma/client";

export async function getReviewCycles() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  return db.reviewCycle.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { assignments: true, summaries: true, forms: true } },
    },
  });
}

export async function getReviewCycle(id: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const cycle = await db.reviewCycle.findUnique({
    where: { id },
    include: {
      forms: {
        include: {
          _count: { select: { assignments: true } },
        },
      },
      _count: { select: { assignments: true, summaries: true } },
    },
  });
  if (!cycle) throw new NotFoundError("Review cycle");
  return cycle;
}

export async function createReviewCycle(data: unknown) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const parsed = createReviewCycleSchema.safeParse(data);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

  const { name, startDate, endDate } = parsed.data;

  const cycle = await db.reviewCycle.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/feedback/cycles");
  return cycle;
}

export async function updateReviewCycle(id: string, data: unknown) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const parsed = updateReviewCycleSchema.safeParse(data);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

  const cycle = await db.reviewCycle.findUnique({ where: { id } });
  if (!cycle) throw new NotFoundError("Review cycle");
  if (cycle.status === "CLOSED" || cycle.status === "ARCHIVED") {
    throw new ValidationError("Cannot edit a closed or archived cycle");
  }

  const updated = await db.reviewCycle.update({
    where: { id },
    data: {
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(parsed.data.startDate && { startDate: new Date(parsed.data.startDate) }),
      ...(parsed.data.endDate && { endDate: new Date(parsed.data.endDate) }),
    },
  });

  revalidatePath("/admin/feedback/cycles");
  revalidatePath(`/admin/feedback/cycles/${id}`);
  return updated;
}

export async function updateCycleStatus(id: string, status: ReviewCycleStatus) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const cycle = await db.reviewCycle.findUnique({ where: { id } });
  if (!cycle) throw new NotFoundError("Review cycle");

  const validTransitions: Record<ReviewCycleStatus, ReviewCycleStatus[]> = {
    DRAFT: ["ACTIVE"],
    ACTIVE: ["CLOSED"],
    CLOSED: ["ARCHIVED"],
    ARCHIVED: [],
  };

  if (!validTransitions[cycle.status].includes(status)) {
    throw new ValidationError(`Cannot transition from ${cycle.status} to ${status}`);
  }

  const updated = await db.reviewCycle.update({ where: { id }, data: { status } });

  revalidatePath("/admin/feedback/cycles");
  revalidatePath(`/admin/feedback/cycles/${id}`);
  return updated;
}

export async function deleteReviewCycle(id: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const cycle = await db.reviewCycle.findUnique({ where: { id } });
  if (!cycle) throw new NotFoundError("Review cycle");
  if (cycle.status !== "DRAFT") throw new ValidationError("Only draft cycles can be deleted");

  await db.reviewCycle.delete({ where: { id } });
  revalidatePath("/admin/feedback/cycles");
  return { success: true };
}

export async function getCycleEmployeeStatus(cycleId: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const assignments = await db.feedbackFormAssignment.findMany({
    where: { reviewCycleId: cycleId },
    include: {
      employee: { select: { id: true, name: true, employeeCode: true, designation: { select: { name: true } } } },
      form: { select: { formType: true, title: true } },
      reviewer: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      reviewCycle: { select: { id: true, name: true } },
      submission: { select: { id: true, submittedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return assignments;
}
