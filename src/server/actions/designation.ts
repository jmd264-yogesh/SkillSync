"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createDesignationSchema } from "@/validations/admin.schema";

export async function getDesignations() {
  return db.designation.findMany({
    include: {
      _count: { select: { employees: true, designationSkills: true } },
    },
    orderBy: { level: "asc" },
  });
}

export async function getDesignationEmployees(designationId: string) {
  return db.employee.findMany({
    where: { designationId },
    include: {
      coe: { select: { name: true } },
      _count: { select: { employeeSkills: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createDesignation(formData: FormData) {
  const parsed = createDesignationSchema.safeParse({
    name: formData.get("name"),
    level: Number(formData.get("level")),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const existing = await db.designation.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: "A designation with this name already exists" };
  }

  await db.designation.create({ data: parsed.data });
  revalidatePath("/admin/designations");
  return { success: true };
}

export async function updateDesignation(id: string, formData: FormData) {
  const parsed = createDesignationSchema.safeParse({
    name: formData.get("name"),
    level: Number(formData.get("level")),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const existing = await db.designation.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
  });
  if (existing) {
    return { error: "A designation with this name already exists" };
  }

  await db.designation.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/designations");
  return { success: true };
}

export async function deleteDesignation(id: string) {
  const designation = await db.designation.findUnique({
    where: { id },
    include: { _count: { select: { employees: true } } },
  });

  if (!designation) {
    return { error: "Designation not found" };
  }

  if (designation._count.employees > 0) {
    return { error: "Cannot delete designation with assigned employees. Reassign them first." };
  }

  await db.designation.delete({ where: { id } });
  revalidatePath("/admin/designations");
  return { success: true };
}
