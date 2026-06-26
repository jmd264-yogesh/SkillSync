"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import type { Prisma } from "@prisma/client";

interface TalentFilter {
  skillId?: string;
  minLevel?: number;
  coeId?: string;
  designationId?: string;
}

export async function searchTalent(filters: TalentFilter) {
  const where: Prisma.EmployeeWhereInput = {};

  if (filters.coeId) where.coeId = filters.coeId;
  if (filters.designationId) where.designationId = filters.designationId;

  if (filters.skillId) {
    where.employeeSkills = {
      some: {
        skillId: filters.skillId,
        status: "APPROVED",
        ...(filters.minLevel ? { validatedLevel: { gte: filters.minLevel } } : {}),
      },
    };
  }

  return db.employee.findMany({
    where,
    include: {
      coe: { select: { name: true } },
      designation: { select: { name: true } },
      manager: { select: { name: true } },
      employeeSkills: {
        where: { status: "APPROVED" },
        include: { skill: { select: { name: true, category: true } } },
        orderBy: { validatedLevel: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getTalentFilterOptions() {
  const [skills, coes, designations] = await Promise.all([
    db.skill.findMany({ select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
    db.coe.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.designation.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return { skills, coes, designations };
}

export async function getSkillDemandProfile() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const [projectRequirements, employeeSkills, allSkills] = await Promise.all([
    db.projectSkillRequirement.findMany({
      where: { project: { status: { in: ["ACTIVE", "PLANNING"] } } },
      include: { skill: { select: { id: true, name: true, category: true } } },
    }),
    db.employeeSkill.findMany({
      where: { status: "APPROVED" },
      select: { skillId: true, validatedLevel: true },
    }),
    db.skill.findMany({ select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
  ]);

  // Aggregate project demand per skill
  const demandMap = new Map<string, { headcount: number; levels: number[] }>();
  for (const req of projectRequirements) {
    const existing = demandMap.get(req.skillId);
    if (existing) {
      existing.headcount += req.headcount;
      existing.levels.push(req.requiredLevel);
    } else {
      demandMap.set(req.skillId, { headcount: req.headcount, levels: [req.requiredLevel] });
    }
  }

  // Aggregate employee supply per skill
  const supplyMap = new Map<string, { count: number; totalLevel: number }>();
  for (const es of employeeSkills) {
    const existing = supplyMap.get(es.skillId);
    if (existing) {
      existing.count++;
      existing.totalLevel += es.validatedLevel ?? 0;
    } else {
      supplyMap.set(es.skillId, { count: 1, totalLevel: es.validatedLevel ?? 0 });
    }
  }

  return allSkills
    .map((skill) => {
      const demand = demandMap.get(skill.id);
      const supply = supplyMap.get(skill.id);
      const projectDemand = demand?.headcount ?? 0;
      const employeeSupply = supply?.count ?? 0;
      const avgSupplyLevel = supply && supply.count > 0
        ? Math.round((supply.totalLevel / supply.count) * 10) / 10
        : 0;
      const avgRequiredLevel = demand && demand.levels.length > 0
        ? Math.round(demand.levels.reduce((a, b) => a + b, 0) / demand.levels.length * 10) / 10
        : 0;

      return {
        skillId: skill.id,
        skillName: skill.name,
        category: skill.category,
        projectDemand,
        employeeSupply,
        avgSupplyLevel,
        avgRequiredLevel,
        gap: projectDemand - employeeSupply,
      };
    })
    .filter((s) => s.projectDemand > 0 || s.employeeSupply > 0)
    .sort((a, b) => b.projectDemand - a.projectDemand || b.employeeSupply - a.employeeSupply);
}
