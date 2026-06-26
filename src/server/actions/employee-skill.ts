"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { SkillApprovalStatus } from "@prisma/client";

export async function getEmployeeSkills(employeeId: string) {
  return db.employeeSkill.findMany({
    where: { employeeId },
    include: {
      skill: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
    },
    orderBy: { skill: { name: "asc" } },
  });
}

export async function mapSkillToEmployee(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const skillId = formData.get("skillId") as string;
  const selfAssessedLevel = parseInt(formData.get("selfAssessedLevel") as string, 10);
  const validatedLevelStr = formData.get("validatedLevel") as string;
  const status = formData.get("status") as SkillApprovalStatus;
  const reviewComment = (formData.get("reviewComment") as string) || null;

  if (!employeeId || !skillId || isNaN(selfAssessedLevel)) {
    return { error: "Employee ID, Skill ID, and Self-Assessed Level are required" };
  }

  const validatedLevel = validatedLevelStr ? parseInt(validatedLevelStr, 10) : null;

  // Check if mapping already exists
  const existing = await db.employeeSkill.findUnique({
    where: {
      employeeId_skillId: {
        employeeId,
        skillId,
      },
    },
  });

  if (existing) {
    return { error: "This skill is already mapped to the employee. Edit the existing mapping instead." };
  }

  try {
    const session = await auth();
    const isApprovedOrRejected = status === "APPROVED" || status === "REJECTED";
    const reviewedBy = isApprovedOrRejected ? (session?.user?.name || "System Admin") : null;
    const reviewedAt = isApprovedOrRejected ? new Date() : null;

    await db.employeeSkill.create({
      data: {
        employeeId,
        skillId,
        selfAssessedLevel,
        validatedLevel,
        status,
        reviewComment,
        reviewedBy,
        reviewedAt,
      },
    });

    revalidatePath("/admin/employee-mapping");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to map skill to employee:", error);
    return { error: "An error occurred while mapping the skill" };
  }
}

export async function updateEmployeeSkill(id: string, formData: FormData) {
  const selfAssessedLevel = parseInt(formData.get("selfAssessedLevel") as string, 10);
  const validatedLevelStr = formData.get("validatedLevel") as string;
  const status = formData.get("status") as SkillApprovalStatus;
  const reviewComment = (formData.get("reviewComment") as string) || null;

  if (isNaN(selfAssessedLevel)) {
    return { error: "Self-Assessed Level is required" };
  }

  const validatedLevel = validatedLevelStr ? parseInt(validatedLevelStr, 10) : null;

  try {
    const session = await auth();
    const isApprovedOrRejected = status === "APPROVED" || status === "REJECTED";
    const reviewedBy = isApprovedOrRejected ? (session?.user?.name || "System Admin") : null;
    const reviewedAt = isApprovedOrRejected ? new Date() : null;

    await db.employeeSkill.update({
      where: { id },
      data: {
        selfAssessedLevel,
        validatedLevel,
        status,
        reviewComment,
        reviewedBy,
        reviewedAt,
      },
    });

    revalidatePath("/admin/employee-mapping");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to update employee skill mapping:", error);
    return { error: "An error occurred while updating the skill mapping" };
  }
}

export async function removeSkillFromEmployee(id: string) {
  try {
    await db.employeeSkill.delete({
      where: { id },
    });

    revalidatePath("/admin/employee-mapping");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to delete employee skill mapping:", error);
    return { error: "An error occurred while deleting the skill mapping" };
  }
}
