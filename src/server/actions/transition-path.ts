"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface TransitionGapItem {
  skillId: string;
  skillName: string;
  category: string;
  currentLevel: number;
  targetLevel: number;
  gap: number;
  priority: "Critical" | "High" | "Medium" | "None";
  status: "met" | "partial" | "missing";
}

export interface TransitionGapResult {
  currentDesignation: string;
  targetDesignation: string;
  targetDesignationLevel: number;
  items: TransitionGapItem[];
  readinessScore: number;
  skillsMet: number;
  totalSkills: number;
  estimatedMonthsMin: number;
  estimatedMonthsMax: number;
}

export async function getDesignationsForTransition() {
  const session = await auth();
  if (!session?.user?.employeeId) return [];

  const employee = await db.employee.findUnique({
    where: { id: session.user.employeeId },
    include: {
      designation: {
        select: {
          id: true,
          level: true,
        },
      },
    },
  });

  if (!employee?.designation) return [];

  return db.designation.findMany({
    where: {
      level: {
        gt: employee.designation.level,
      },
    },
    orderBy: {
      level: "asc",
    },
    select: {
      id: true,
      name: true,
      level: true,
    },
  });
}

export async function getTransitionGap(targetDesignationId: string): Promise<TransitionGapResult | null> {
  const session = await auth();
  if (!session?.user?.employeeId) return null;

  const [employee, targetDesignation] = await Promise.all([
    db.employee.findUnique({
      where: { id: session.user.employeeId },
      include: {
        designation: true,
        employeeSkills: {
          where: { status: "APPROVED" },
          include: { skill: true },
        },
      },
    }),
    db.designation.findUnique({
      where: { id: targetDesignationId },
      include: { designationSkills: { include: { skill: true } } },
    }),
  ]);

  if (!employee || !targetDesignation) return null;

  const currentMap = new Map<string, number>();
  for (const es of employee.employeeSkills) {
    currentMap.set(es.skillId, es.validatedLevel ?? 0);
  }

  const items: TransitionGapItem[] = targetDesignation.designationSkills.map((ds) => {
    const currentLevel = currentMap.get(ds.skillId) ?? 0;
    const gap = Math.max(0, ds.targetCompetency - currentLevel);
    const priority: TransitionGapItem["priority"] =
      gap >= 4 ? "Critical" : gap >= 3 ? "High" : gap >= 1 ? "Medium" : "None";
    const status: TransitionGapItem["status"] =
      gap === 0 ? "met" : currentLevel > 0 ? "partial" : "missing";
    return {
      skillId: ds.skillId,
      skillName: ds.skill.name,
      category: ds.skill.category,
      currentLevel,
      targetLevel: ds.targetCompetency,
      gap,
      priority,
      status,
    };
  });

  items.sort((a, b) => b.gap - a.gap);

  const met = items.filter((i) => i.gap === 0).length;
  const total = items.length;
  const readinessScore = total > 0 ? Math.round((met / total) * 100) : 0;
  const totalGapPoints = items.reduce((sum, i) => sum + i.gap, 0);

  return {
    currentDesignation: employee.designation?.name ?? "Unassigned",
    targetDesignation: targetDesignation.name,
    targetDesignationLevel: targetDesignation.level,
    items,
    readinessScore,
    skillsMet: met,
    totalSkills: total,
    estimatedMonthsMin: Math.max(1, Math.ceil(totalGapPoints * 1.5)),
    estimatedMonthsMax: Math.max(2, Math.ceil(totalGapPoints * 2.5)),
  };
}
