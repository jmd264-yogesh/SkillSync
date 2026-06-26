"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSkillSchema } from "@/validations/skill.schema";

export async function getSkills() {
  return db.skill.findMany({
    include: {
      _count: { select: { employeeSkills: true, coeSkills: true, designationSkills: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createSkill(formData: FormData) {
  const parsed = createSkillSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const existing = await db.skill.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: "A skill with this name already exists" };
  }

  await db.skill.create({ data: parsed.data });
  revalidatePath("/admin/skills");
  return { success: true };
}

export async function updateSkill(id: string, formData: FormData) {
  const parsed = createSkillSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const existing = await db.skill.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
  });
  if (existing) {
    return { error: "A skill with this name already exists" };
  }

  await db.skill.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/skills");
  return { success: true };
}

export async function deleteSkill(id: string) {
  const skill = await db.skill.findUnique({
    where: { id },
    include: { _count: { select: { employeeSkills: true } } },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  if (skill._count.employeeSkills > 0) {
    return { error: "Cannot delete skill that is assigned to employees." };
  }

  await db.skill.delete({ where: { id } });
  revalidatePath("/admin/skills");
  return { success: true };
}
