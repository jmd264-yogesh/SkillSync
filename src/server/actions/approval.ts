"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getPendingApprovals() {
  const session = await auth();
  if (!session?.user) return [];

  const isAdmin = session.user.role === "ADMIN";
  const employeeId = session.user.employeeId;

  const where = isAdmin
    ? {}
    : {
        employee: { managerId: employeeId },
      };

  return db.employeeSkill.findMany({
    where: {
      ...where,
      status: "PENDING",
    },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          employeeCode: true,
          coe: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
      skill: true,
      evidences: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllApprovals(statusFilter?: string) {
  const session = await auth();
  if (!session?.user) return [];

  const isAdmin = session.user.role === "ADMIN";
  const employeeId = session.user.employeeId;

  const where = isAdmin
    ? statusFilter && statusFilter !== "ALL"
      ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" }
      : {}
    : {
        employee: { managerId: employeeId },
        ...(statusFilter && statusFilter !== "ALL"
          ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" }
          : {}),
      };

  return db.employeeSkill.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          employeeCode: true,
          coe: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
      skill: true,
      evidences: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function approveSkill(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const employeeSkillId = formData.get("employeeSkillId") as string;
  const validatedLevel = Number(formData.get("validatedLevel"));
  const reviewComment = (formData.get("reviewComment") as string) || null;

  if (!employeeSkillId || !validatedLevel) {
    return { error: "Skill and validated level are required" };
  }

  const skill = await db.employeeSkill.findUnique({ where: { id: employeeSkillId } });
  if (!skill) return { error: "Skill submission not found" };

  await db.employeeSkill.update({
    where: { id: employeeSkillId },
    data: {
      status: "APPROVED",
      validatedLevel,
      reviewComment,
      reviewedBy: session.user.name,
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/manager/approvals");
  revalidatePath("/employee/my-skills");
  return { success: true };
}

export async function rejectSkill(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const employeeSkillId = formData.get("employeeSkillId") as string;
  const reviewComment = formData.get("reviewComment") as string;

  if (!employeeSkillId || !reviewComment) {
    return { error: "Rejection reason is required" };
  }

  const skill = await db.employeeSkill.findUnique({ where: { id: employeeSkillId } });
  if (!skill) return { error: "Skill submission not found" };

  await db.employeeSkill.update({
    where: { id: employeeSkillId },
    data: {
      status: "REJECTED",
      reviewComment,
      reviewedBy: session.user.name,
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/manager/approvals");
  revalidatePath("/employee/my-skills");
  return { success: true };
}
