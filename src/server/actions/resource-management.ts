"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ProjectStatus, RequirementPriority, SkillCategory } from "@prisma/client";

export async function getResourceDashboard() {
  const [projects, employees] = await Promise.all([
    db.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        skillRequirements: {
          include: { skill: true },
        },
        allocations: {
          include: {
            employee: {
              include: {
                coe: true,
                designation: true,
                employeeSkills: {
                  where: { status: "APPROVED" },
                  include: { skill: true },
                  take: 4,
                },
              },
            },
          },
        },
      },
    }),
    db.employee.findMany({
      orderBy: { name: "asc" },
      include: {
        coe: true,
        designation: true,
        allocations: {
          where: {
            project: { status: { notIn: ["COMPLETED"] } },
          },
          include: { project: true },
        },
        employeeSkills: {
          where: { status: "APPROVED" },
          include: { skill: true },
          take: 4,
        },
      },
    }),
  ]);

  return { projects, employees };
}

export async function createProject(formData: FormData): Promise<{ error: string } | { success: true }> {
  const name = formData.get("name");
  if (typeof name !== "string" || name.trim() === "") {
    return { error: "Project name is required" };
  }

  const description = formData.get("description");
  const domain = formData.get("domain");
  const startDateStr = formData.get("startDate");
  const endDateStr = formData.get("endDate");
  const teamSizeStr = formData.get("teamSize");
  const statusRaw = formData.get("status");

  const startDate = typeof startDateStr === "string" && startDateStr ? new Date(startDateStr) : null;
  const endDate = typeof endDateStr === "string" && endDateStr ? new Date(endDateStr) : null;
  const teamSize = typeof teamSizeStr === "string" && teamSizeStr ? parseInt(teamSizeStr, 10) : null;
  const status: ProjectStatus =
    typeof statusRaw === "string" && ["PLANNING", "ACTIVE", "COMPLETED", "ON_HOLD"].includes(statusRaw)
      ? (statusRaw as ProjectStatus)
      : "ACTIVE";

  await db.project.create({
    data: {
      name: name.trim(),
      description: typeof description === "string" && description ? description : null,
      domain: typeof domain === "string" && domain ? domain : null,
      startDate,
      endDate,
      teamSize: teamSize !== null && !isNaN(teamSize) ? teamSize : null,
      status,
    },
  });

  revalidatePath("/admin/resource-management");
  return { success: true };
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
  await db.project.update({ where: { id: projectId }, data: { status } });
  revalidatePath("/admin/resource-management");
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.project.delete({ where: { id: projectId } });
  revalidatePath("/admin/resource-management");
}

export async function addSkillRequirement(
  projectId: string,
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const skillId = formData.get("skillId");
  const requiredLevelStr = formData.get("requiredLevel");
  const headcountStr = formData.get("headcount");
  const priorityRaw = formData.get("priority");

  if (typeof skillId !== "string" || !skillId) return { error: "Skill is required" };

  const requiredLevel = typeof requiredLevelStr === "string" ? parseInt(requiredLevelStr, 10) : NaN;
  const headcount = typeof headcountStr === "string" ? parseInt(headcountStr, 10) : NaN;

  if (isNaN(requiredLevel) || requiredLevel < 1 || requiredLevel > 5) {
    return { error: "Required level must be between 1 and 5" };
  }
  if (isNaN(headcount) || headcount < 1) {
    return { error: "Headcount must be at least 1" };
  }

  const priority: RequirementPriority =
    typeof priorityRaw === "string" && ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(priorityRaw)
      ? (priorityRaw as RequirementPriority)
      : "MEDIUM";

  await db.projectSkillRequirement.upsert({
    where: { projectId_skillId: { projectId, skillId } },
    update: { requiredLevel, headcount, priority },
    create: { projectId, skillId, requiredLevel, headcount, priority },
  });

  revalidatePath("/admin/resource-management");
  return { success: true };
}

export async function removeSkillRequirement(requirementId: string): Promise<void> {
  await db.projectSkillRequirement.delete({ where: { id: requirementId } });
  revalidatePath("/admin/resource-management");
}

export async function allocateEmployee(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const projectId = formData.get("projectId");
  const employeeId = formData.get("employeeId");
  const allocationStr = formData.get("allocation");
  const role = formData.get("role");
  const startDateStr = formData.get("startDate");
  const endDateStr = formData.get("endDate");

  if (typeof projectId !== "string" || !projectId) return { error: "Project is required" };
  if (typeof employeeId !== "string" || !employeeId) return { error: "Employee is required" };

  const newAllocation = typeof allocationStr === "string" ? parseFloat(allocationStr) : NaN;
  if (isNaN(newAllocation) || newAllocation <= 0) return { error: "Valid allocation percentage is required" };

  const startDate = typeof startDateStr === "string" && startDateStr ? new Date(startDateStr) : null;
  const endDate = typeof endDateStr === "string" && endDateStr ? new Date(endDateStr) : null;

  const existingAllocations = await db.projectAllocation.findMany({
    where: {
      employeeId,
      project: { status: { notIn: ["COMPLETED"] } },
      NOT: { projectId },
    },
  });

  const totalExisting = existingAllocations.reduce((sum, a) => sum + a.allocation, 0);

  if (totalExisting + newAllocation > 100) {
    return {
      error: `Employee is already at ${totalExisting}% allocation. Cannot add ${newAllocation}%`,
    };
  }

  await db.projectAllocation.upsert({
    where: { projectId_employeeId: { projectId, employeeId } },
    update: {
      allocation: newAllocation,
      role: typeof role === "string" && role ? role : null,
      startDate,
      endDate,
    },
    create: {
      projectId,
      employeeId,
      allocation: newAllocation,
      role: typeof role === "string" && role ? role : null,
      startDate,
      endDate,
    },
  });

  revalidatePath("/admin/resource-management");
  return { success: true };
}

export async function updateAllocation(allocationId: string, allocation: number): Promise<void> {
  await db.projectAllocation.update({ where: { id: allocationId }, data: { allocation } });
  revalidatePath("/admin/resource-management");
}

export async function removeAllocation(allocationId: string): Promise<void> {
  await db.projectAllocation.delete({ where: { id: allocationId } });
  revalidatePath("/admin/resource-management");
}

export async function createSkillAndAddRequirement(
  projectId: string,
  skillName: string,
  skillCategory: SkillCategory,
  requiredLevel: number,
  headcount: number,
  priority: RequirementPriority,
): Promise<{ error: string } | { success: true }> {
  if (!skillName.trim()) return { error: "Skill name is required" };

  const skill = await db.skill.upsert({
    where: { name: skillName.trim() },
    update: {},
    create: { name: skillName.trim(), category: skillCategory },
  });

  await db.projectSkillRequirement.upsert({
    where: { projectId_skillId: { projectId, skillId: skill.id } },
    update: { requiredLevel, headcount, priority },
    create: { projectId, skillId: skill.id, requiredLevel, headcount, priority },
  });

  revalidatePath("/admin/resource-management");
  return { success: true };
}

export async function getSkillsForSelect() {
  return db.skill.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true },
  });
}

export async function getEmployeesForSelect() {
  return db.employee.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      coe: { select: { name: true } },
      designation: { select: { name: true } },
    },
  });
}
