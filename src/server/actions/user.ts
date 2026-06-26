"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

export async function getUsers() {
  return db.user.findMany({
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          employeeCode: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createUser(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as UserRole;
  const password = formData.get("password") as string;
  const employeeId = (formData.get("employeeId") as string) || null;

  if (!name || !email || !role || !password) {
    return { error: "Name, email, role, and password are required" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long" };
  }

  // Check unique email
  const existingEmail = await db.user.findUnique({
    where: { email },
  });
  if (existingEmail) {
    return { error: "Email already in use" };
  }

  // Check if employee is already linked to another user
  if (employeeId) {
    const linkedUser = await db.user.findUnique({
      where: { employeeId },
    });
    if (linkedUser) {
      return { error: "Selected employee is already linked to another user" };
    }
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.user.create({
      data: {
        name,
        email,
        role,
        passwordHash,
        employeeId: employeeId || null,
      },
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to create user:", error);
    return { error: "An error occurred while creating the user" };
  }
}

export async function updateUser(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as UserRole;
  const password = formData.get("password") as string | null;
  const employeeId = (formData.get("employeeId") as string) || null;

  if (!name || !email || !role) {
    return { error: "Name, email, and role are required" };
  }

  // Check unique email excluding current user
  const existingEmail = await db.user.findFirst({
    where: {
      email,
      NOT: { id },
    },
  });
  if (existingEmail) {
    return { error: "Email already in use" };
  }

  // Check employee linkage excluding current user
  if (employeeId) {
    const linkedUser = await db.user.findFirst({
      where: {
        employeeId,
        NOT: { id },
      },
    });
    if (linkedUser) {
      return { error: "Selected employee is already linked to another user" };
    }
  }

  try {
    const updateData: {
      name: string;
      email: string;
      role: UserRole;
      employeeId: string | null;
      passwordHash?: string;
    } = {
      name,
      email,
      role,
      employeeId: employeeId || null,
    };

    if (password && password.trim().length > 0) {
      if (password.length < 8) {
        return { error: "Password must be at least 8 characters long" };
      }
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    await db.user.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to update user:", error);
    return { error: "An error occurred while updating the user" };
  }
}

export async function deleteUser(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  if (session.user.id === id) {
    return { error: "You cannot delete your own account" };
  }

  try {
    const userToDelete = await db.user.findUnique({
      where: { id },
    });

    if (!userToDelete) {
      return { error: "User not found" };
    }

    // Prevent deleting the last Admin
    if (userToDelete.role === "ADMIN") {
      const adminCount = await db.user.count({
        where: { role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return { error: "Cannot delete the last remaining administrator" };
      }
    }

    await db.user.delete({
      where: { id },
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to delete user:", error);
    return { error: "An error occurred while deleting the user" };
  }
}
