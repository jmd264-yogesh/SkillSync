"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { createClusterSchema } from "@/validations/admin.schema";
import { revalidatePath } from "next/cache";

export async function getClusters() {
  const session = await auth();
  if (!session) throw new UnauthorizedError();

  return db.cluster.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  });
}

export async function createCluster(formData: FormData) {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const parsed = createClusterSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await db.cluster.create({ data: { name: parsed.data.name, description: parsed.data.description } });
    revalidatePath("/admin/config");
    return { success: true };
  } catch {
    return { error: "A cluster with this name already exists" };
  }
}

export async function updateCluster(id: string, formData: FormData) {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const parsed = createClusterSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await db.cluster.update({ where: { id }, data: { name: parsed.data.name, description: parsed.data.description } });
    revalidatePath("/admin/config");
    return { success: true };
  } catch {
    return { error: "A cluster with this name already exists" };
  }
}

export async function deleteCluster(id: string) {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const cluster = await db.cluster.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } });
  if (cluster?._count.employees && cluster._count.employees > 0) {
    return { error: "Cannot delete a cluster that has employees assigned to it" };
  }

  await db.cluster.delete({ where: { id } });
  revalidatePath("/admin/config");
  return { success: true };
}

export async function getClusterEmployees(clusterId: string) {
  const session = await auth();
  if (!session) throw new UnauthorizedError();

  return db.employee.findMany({
    where: { clusterId },
    select: { id: true, name: true, employeeCode: true, designation: { select: { name: true } }, _count: { select: { employeeSkills: true } } },
    orderBy: { name: "asc" },
  });
}
