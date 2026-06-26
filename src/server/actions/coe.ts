"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createCoeSchema } from "@/validations/admin.schema";

export async function getCoes() {
  return db.coe.findMany({
    include: {
      _count: { select: { employees: true, coeSkills: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createCoe(formData: FormData) {
  const parsed = createCoeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const existing = await db.coe.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: "A COE with this name already exists" };
  }

  await db.coe.create({ data: parsed.data });
  revalidatePath("/admin/coe");
  return { success: true };
}

export async function updateCoe(id: string, formData: FormData) {
  const parsed = createCoeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const existing = await db.coe.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
  });
  if (existing) {
    return { error: "A COE with this name already exists" };
  }

  await db.coe.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/coe");
  return { success: true };
}

export async function getCoeEmployees(coeId: string) {
  return db.employee.findMany({
    where: { coeId },
    include: {
      designation: { select: { name: true } },
      _count: { select: { employeeSkills: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function deleteCoe(id: string) {
  const coe = await db.coe.findUnique({
    where: { id },
    include: { _count: { select: { employees: true } } },
  });

  if (!coe) {
    return { error: "COE not found" };
  }

  if (coe._count.employees > 0) {
    return { error: "Cannot delete COE with assigned employees. Reassign them first." };
  }

  await db.coe.delete({ where: { id } });
  revalidatePath("/admin/coe");
  return { success: true };
}
