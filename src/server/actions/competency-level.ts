"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createCompetencyLevelSchema } from "@/validations/admin.schema";

export async function getCompetencyLevels() {
  return db.competencyLevel.findMany({
    orderBy: { level: "asc" },
  });
}

export async function createCompetencyLevel(formData: FormData) {
  const parsed = createCompetencyLevelSchema.safeParse({
    level: Number(formData.get("level")),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const existing = await db.competencyLevel.findUnique({ where: { level: parsed.data.level } });
  if (existing) {
    return { error: `Level ${parsed.data.level} already exists` };
  }

  await db.competencyLevel.create({ data: parsed.data });
  revalidatePath("/admin/competency-levels");
  return { success: true };
}

export async function updateCompetencyLevel(id: string, formData: FormData) {
  const parsed = createCompetencyLevelSchema.safeParse({
    level: Number(formData.get("level")),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const existing = await db.competencyLevel.findFirst({
    where: { level: parsed.data.level, NOT: { id } },
  });
  if (existing) {
    return { error: `Level ${parsed.data.level} already exists` };
  }

  await db.competencyLevel.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/competency-levels");
  return { success: true };
}

export async function deleteCompetencyLevel(id: string) {
  await db.competencyLevel.delete({ where: { id } });
  revalidatePath("/admin/competency-levels");
  return { success: true };
}
