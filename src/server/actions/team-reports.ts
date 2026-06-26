"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { computeReadiness } from "@/server/services/readiness.service";
import type { SkillApprovalStatus } from "@prisma/client";

export interface TeamMemberSummary {
  id: string;
  name: string;
  employeeCode: string;
  coeName: string | null;
  designationName: string | null;
  approvedCount: number;
  pendingCount: number;
  totalTargetSkills: number;
  readinessScore: number;
  skillsMet: number;
}

export interface TeamMemberDetail {
  employee: {
    id: string;
    name: string;
    employeeCode: string;
    email: string;
    coeName: string | null;
    designationName: string | null;
  };
  skills: Array<{
    id: string;
    skillName: string;
    category: string;
    selfAssessedLevel: number;
    validatedLevel: number | null;
    status: SkillApprovalStatus;
    evidenceCount: number;
    reviewedAt: Date | null;
  }>;
  gaps: Array<{
    skillName: string;
    targetLevel: number;
    currentLevel: number;
    gap: number;
    status: "met" | "partial" | "missing";
  }>;
  readinessScore: number;
  skillsMet: number;
  totalTargetSkills: number;
}

export async function getTeamReports(): Promise<TeamMemberSummary[]> {
  const session = await auth();
  if (!session?.user?.employeeId) return [];

  const manager = await db.employee.findUnique({
    where: { id: session.user.employeeId },
    include: {
      reportees: {
        include: {
          coe: { include: { coeSkills: true } },
          designation: { include: { designationSkills: true } },
          employeeSkills: true,
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!manager) return [];

  return manager.reportees.map((emp) => {
    const approved = emp.employeeSkills.filter((s) => s.status === "APPROVED");
    const pending = emp.employeeSkills.filter((s) => s.status === "PENDING");
    const r = computeReadiness(emp.coe?.coeSkills ?? [], emp.designation?.designationSkills ?? [], approved);

    return {
      id: emp.id,
      name: emp.name,
      employeeCode: emp.employeeCode,
      coeName: emp.coe?.name ?? null,
      designationName: emp.designation?.name ?? null,
      approvedCount: approved.length,
      pendingCount: pending.length,
      totalTargetSkills: r.total,
      readinessScore: r.percentage,
      skillsMet: r.met,
    };
  });
}

export async function getTeamMemberDetail(employeeId: string): Promise<TeamMemberDetail | null> {
  const session = await auth();
  if (!session?.user?.employeeId) return null;

  const employee = await db.employee.findFirst({
    where: { id: employeeId, managerId: session.user.employeeId },
    include: {
      coe: { include: { coeSkills: { include: { skill: true } } } },
      designation: { include: { designationSkills: { include: { skill: true } } } },
      employeeSkills: {
        include: { skill: true, evidences: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!employee) return null;

  const targetMap = new Map<string, { targetLevel: number; skillName: string }>();

  for (const cs of employee.coe?.coeSkills ?? []) {
    targetMap.set(cs.skillId, { targetLevel: cs.targetCompetency, skillName: cs.skill.name });
  }
  for (const ds of employee.designation?.designationSkills ?? []) {
    const existing = targetMap.get(ds.skillId);
    if (existing) {
      targetMap.set(ds.skillId, { ...existing, targetLevel: Math.max(existing.targetLevel, ds.targetCompetency) });
    } else {
      targetMap.set(ds.skillId, { targetLevel: ds.targetCompetency, skillName: ds.skill.name });
    }
  }

  const approved = employee.employeeSkills.filter((s) => s.status === "APPROVED");
  const currentLevels = new Map<string, number>();
  for (const es of approved) {
    currentLevels.set(es.skillId, es.validatedLevel ?? 0);
  }

  const gaps = Array.from(targetMap.entries()).map(([skillId, target]) => {
    const currentLevel = currentLevels.get(skillId) ?? 0;
    const gap = Math.max(0, target.targetLevel - currentLevel);
    const status: "met" | "partial" | "missing" =
      gap === 0 ? "met" : currentLevel > 0 ? "partial" : "missing";
    return { skillName: target.skillName, targetLevel: target.targetLevel, currentLevel, gap, status };
  });
  gaps.sort((a, b) => b.gap - a.gap);

  const r = computeReadiness(
    employee.coe?.coeSkills ?? [],
    employee.designation?.designationSkills ?? [],
    approved,
  );

  return {
    employee: {
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeCode,
      email: employee.email,
      coeName: employee.coe?.name ?? null,
      designationName: employee.designation?.name ?? null,
    },
    skills: employee.employeeSkills.map((s) => ({
      id: s.id,
      skillName: s.skill.name,
      category: s.skill.category,
      selfAssessedLevel: s.selfAssessedLevel,
      validatedLevel: s.validatedLevel,
      status: s.status,
      evidenceCount: s.evidences.length,
      reviewedAt: s.reviewedAt,
    })),
    gaps,
    readinessScore: r.percentage,
    skillsMet: r.met,
    totalTargetSkills: r.total,
  };
}
