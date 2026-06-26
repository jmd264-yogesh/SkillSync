"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getMySkills() {
  const session = await auth();
  if (!session?.user?.employeeId) return [];

  return db.employeeSkill.findMany({
    where: { employeeId: session.user.employeeId },
    include: {
      skill: true,
      evidences: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMyTargetSkills() {
  const session = await auth();
  if (!session?.user?.employeeId) return [];

  const employee = await db.employee.findUnique({
    where: { id: session.user.employeeId },
    select: { coeId: true, designationId: true },
  });
  if (!employee) return [];

  const coeSkills = employee.coeId
    ? await db.coeSkill.findMany({
        where: { coeId: employee.coeId },
        include: { skill: { select: { id: true, name: true, category: true } } },
      })
    : [];

  const desigSkills = employee.designationId
    ? await db.designationSkill.findMany({
        where: { designationId: employee.designationId },
        include: { skill: { select: { id: true, name: true, category: true } } },
      })
    : [];

  const map = new Map<string, { skillId: string; skillName: string; category: string; targetLevel: number; source: string }>();

  for (const cs of coeSkills) {
    map.set(cs.skillId, {
      skillId: cs.skillId,
      skillName: cs.skill.name,
      category: cs.skill.category,
      targetLevel: cs.targetCompetency,
      source: "COE",
    });
  }

  for (const ds of desigSkills) {
    const existing = map.get(ds.skillId);
    if (existing) {
      map.set(ds.skillId, { ...existing, targetLevel: Math.max(existing.targetLevel, ds.targetCompetency), source: "Both" });
    } else {
      map.set(ds.skillId, {
        skillId: ds.skillId,
        skillName: ds.skill.name,
        category: ds.skill.category,
        targetLevel: ds.targetCompetency,
        source: "Designation",
      });
    }
  }

  return Array.from(map.values());
}

export async function getAvailableSkills() {
  const session = await auth();
  if (!session?.user?.employeeId) return [];

  const existingSkillIds = await db.employeeSkill.findMany({
    where: { employeeId: session.user.employeeId },
    select: { skillId: true },
  });

  const ids = existingSkillIds.map((s) => s.skillId);

  return db.skill.findMany({
    where: { id: { notIn: ids } },
    orderBy: { name: "asc" },
  });
}

export async function submitSkill(formData: FormData) {
  const session = await auth();
  if (!session?.user?.employeeId) {
    return { error: "Not authenticated as an employee" };
  }

  const skillId = formData.get("skillId") as string;
  const selfAssessedLevel = Number(formData.get("selfAssessedLevel"));
  const evidenceType = formData.get("evidenceType") as string | null;
  const evidenceTitle = formData.get("evidenceTitle") as string | null;
  const evidenceDescription = formData.get("evidenceDescription") as string | null;
  const evidenceScore = formData.get("evidenceScore") as string | null;

  if (!skillId || !selfAssessedLevel || selfAssessedLevel < 1 || selfAssessedLevel > 5) {
    return { error: "Skill and competency level (1-5) are required" };
  }

  const existing = await db.employeeSkill.findUnique({
    where: { employeeId_skillId: { employeeId: session.user.employeeId, skillId } },
  });
  if (existing) {
    return { error: "You have already added this skill" };
  }

  await db.$transaction(async (tx) => {
    const employeeSkill = await tx.employeeSkill.create({
      data: {
        employeeId: session.user.employeeId!,
        skillId,
        selfAssessedLevel,
        status: "PENDING",
      },
    });

    if (evidenceType && evidenceTitle) {
      await tx.evidence.create({
        data: {
          employeeSkillId: employeeSkill.id,
          employeeId: session.user.employeeId!,
          type: evidenceType as "CERTIFICATION" | "ASSESSMENT_SCORE" | "PROJECT_DOCUMENT" | "SUPPORTING_DOCUMENT",
          title: evidenceTitle,
          description: evidenceDescription,
          score: evidenceScore,
        },
      });
    }
  });

  revalidatePath("/employee/my-skills");
  return { success: true };
}

export async function withdrawSkill(employeeSkillId: string) {
  const session = await auth();
  if (!session?.user?.employeeId) {
    return { error: "Not authenticated" };
  }

  const skill = await db.employeeSkill.findFirst({
    where: { id: employeeSkillId, employeeId: session.user.employeeId },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  await db.$transaction(async (tx) => {
    await tx.evidence.deleteMany({ where: { employeeSkillId } });
    await tx.employeeSkill.delete({ where: { id: employeeSkillId } });
  });

  revalidatePath("/employee/my-skills");
  return { success: true };
}
