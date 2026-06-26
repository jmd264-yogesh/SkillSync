"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

interface GapItem {
  skillId: string;
  skillName: string;
  category: string;
  targetLevel: number;
  currentLevel: number;
  gap: number;
  status: "met" | "partial" | "missing";
  source: "COE" | "Designation" | "Both";
}

interface GapAnalysisResult {
  items: GapItem[];
  readiness: {
    met: number;
    partial: number;
    missing: number;
    total: number;
    percentage: number;
  };
  employeeName: string;
  coeName: string | null;
  designationName: string | null;
}

export async function getMyGapAnalysis(): Promise<GapAnalysisResult | null> {
  const session = await auth();
  if (!session?.user?.employeeId) return null;

  const employee = await db.employee.findUnique({
    where: { id: session.user.employeeId },
    include: {
      coe: { include: { coeSkills: { include: { skill: true } } } },
      designation: { include: { designationSkills: { include: { skill: true } } } },
      employeeSkills: {
        where: { status: "APPROVED" },
        include: { skill: true },
      },
    },
  });

  if (!employee) return null;

  const targetMap = new Map<string, { targetLevel: number; skillName: string; category: string; source: "COE" | "Designation" | "Both" }>();

  if (employee.coe) {
    for (const cs of employee.coe.coeSkills) {
      targetMap.set(cs.skillId, {
        targetLevel: cs.targetCompetency,
        skillName: cs.skill.name,
        category: cs.skill.category,
        source: "COE",
      });
    }
  }

  if (employee.designation) {
    for (const ds of employee.designation.designationSkills) {
      const existing = targetMap.get(ds.skillId);
      if (existing) {
        targetMap.set(ds.skillId, {
          ...existing,
          targetLevel: Math.max(existing.targetLevel, ds.targetCompetency),
          source: "Both",
        });
      } else {
        targetMap.set(ds.skillId, {
          targetLevel: ds.targetCompetency,
          skillName: ds.skill.name,
          category: ds.skill.category,
          source: "Designation",
        });
      }
    }
  }

  const currentMap = new Map<string, number>();
  for (const es of employee.employeeSkills) {
    currentMap.set(es.skillId, es.validatedLevel ?? 0);
  }

  const items: GapItem[] = [];
  for (const [skillId, target] of targetMap) {
    const currentLevel = currentMap.get(skillId) ?? 0;
    const gap = Math.max(0, target.targetLevel - currentLevel);
    items.push({
      skillId,
      skillName: target.skillName,
      category: target.category,
      targetLevel: target.targetLevel,
      currentLevel,
      gap,
      status: gap === 0 ? "met" : currentLevel > 0 ? "partial" : "missing",
      source: target.source,
    });
  }

  items.sort((a, b) => b.gap - a.gap);

  const met = items.filter((i) => i.status === "met").length;
  const partial = items.filter((i) => i.status === "partial").length;
  const missing = items.filter((i) => i.status === "missing").length;
  const total = items.length;
  const percentage = total > 0 ? Math.round((met / total) * 100) : 0;

  return {
    items,
    readiness: { met, partial, missing, total, percentage },
    employeeName: employee.name,
    coeName: employee.coe?.name ?? null,
    designationName: employee.designation?.name ?? null,
  };
}
