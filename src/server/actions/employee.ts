"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createEmployeeSchema } from "@/validations/employee.schema";
import type { UserRole } from "@prisma/client";

export async function getEmployees() {
  return db.employee.findMany({
    include: {
      coe: true,
      designation: true,
      manager: { select: { id: true, name: true } },
      user: { select: { id: true, email: true, role: true } },
      _count: { select: { employeeSkills: true, reportees: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getEmployeeOptions() {
  return db.employee.findMany({
    select: { id: true, name: true, employeeCode: true },
    orderBy: { name: "asc" },
  });
}

export async function createEmployee(formData: FormData) {
  const parsed = createEmployeeSchema.safeParse({
    employeeCode: formData.get("employeeCode"),
    name: formData.get("name"),
    email: formData.get("email"),
    coeId: formData.get("coeId") || undefined,
    designationId: formData.get("designationId") || undefined,
    managerId: formData.get("managerId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const existingCode = await db.employee.findUnique({
    where: { employeeCode: parsed.data.employeeCode },
  });
  if (existingCode) {
    return { error: "Employee code already exists" };
  }

  const existingEmail = await db.employee.findUnique({
    where: { email: parsed.data.email },
  });
  if (existingEmail) {
    return { error: "Email already exists" };
  }

  const role = (formData.get("role") as UserRole) || "EMPLOYEE";
  const password = (formData.get("password") as string) || "password123";
  const passwordHash = await bcrypt.hash(password, 12);

  await db.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        employeeCode: parsed.data.employeeCode,
        name: parsed.data.name,
        email: parsed.data.email,
        coeId: parsed.data.coeId || null,
        designationId: parsed.data.designationId || null,
        managerId: parsed.data.managerId || null,
      },
    });

    await tx.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        role,
        employeeId: employee.id,
      },
    });
  });

  revalidatePath("/admin/employee-mapping");
  return { success: true };
}

export async function updateEmployee(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const coeId = (formData.get("coeId") as string) || null;
  const designationId = (formData.get("designationId") as string) || null;
  const managerId = (formData.get("managerId") as string) || null;
  const role = formData.get("role") as UserRole | null;

  if (!name || !email) {
    return { error: "Name and email are required" };
  }

  if (managerId === id) {
    return { error: "An employee cannot be their own manager" };
  }

  const existingEmail = await db.employee.findFirst({
    where: { email, NOT: { id } },
  });
  if (existingEmail) {
    return { error: "Email already in use by another employee" };
  }

  await db.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id },
      data: { name, email, coeId, designationId, managerId },
    });

    const updateData: { name: string; email: string; role?: UserRole } = { name, email };
    if (role) {
      updateData.role = role;
    }

    await tx.user.updateMany({
      where: { employeeId: id },
      data: updateData,
    });
  });

  revalidatePath("/admin/employee-mapping");
  return { success: true };
}

export async function deleteEmployee(id: string) {
  const employee = await db.employee.findUnique({
    where: { id },
    include: { _count: { select: { reportees: true, employeeSkills: true } } },
  });

  if (!employee) {
    return { error: "Employee not found" };
  }

  if (employee._count.reportees > 0) {
    return { error: "Cannot delete employee who manages other employees. Reassign reportees first." };
  }

  await db.$transaction(async (tx) => {
    await tx.user.deleteMany({ where: { employeeId: id } });
    await tx.employeeSkill.deleteMany({ where: { employeeId: id } });
    await tx.employee.delete({ where: { id } });
  });

  revalidatePath("/admin/employee-mapping");
  return { success: true };
}
