import { db } from "@/lib/db";
import { MATCH_WEIGHTS } from "@/lib/constants";

export type MatchSignal = "REDEPLOY" | "HIRE" | "PARTIAL_HIRE";

export interface SkillBreakdown {
  skillName: string;
  required: number;
  current: number;
  met: boolean;
}

export interface MatchResult {
  employeeId: string;
  name: string;
  jobName: string | null;
  skillScore: number;
  competencyScore: number;
  availabilityFit: number;
  billabilityFit: number;
  evidenceStrength: number;
  matchScore: number;
  skillBreakdown: SkillBreakdown[];
  unmetSkills: string[];
  availableFTE: number;
  signal: MatchSignal;
}

/**
 * Compute match score for all employees against a set of required skills.
 * Returns ranked list. Skill and competency are scored SEPARATELY.
 */
export async function computeMatchRanking(params: {
  requiredSkills: { skillId: string; skillName: string; requiredLevel: number }[];
  windowStart?: Date;
  windowEnd?: Date;
  topN?: number;
}): Promise<MatchResult[]> {
  const { requiredSkills, windowStart, windowEnd, topN = 20 } = params;
  if (requiredSkills.length === 0) return [];

  const skillIds = requiredSkills.map((s) => s.skillId);

  const employees = await db.employee.findMany({
    include: {
      employeeSkills: {
        where: { status: "APPROVED", skillId: { in: skillIds } },
        include: { skill: true, evidences: true },
      },
      competencies: true,
      allocations: {
        where: { project: { status: { notIn: ["COMPLETED"] } } },
        include: { project: { select: { status: true } } },
      },
      utilisationSnapshots: { orderBy: { weekStart: "desc" }, take: 4 },
    },
  });

  const results: MatchResult[] = employees.map((emp) => {
    // ── Skill Score ──────────────────────────────────────────
    let skillCoverage = 0;
    let skillDepth = 0;
    const breakdown: SkillBreakdown[] = [];
    const unmet: string[] = [];

    for (const req of requiredSkills) {
      const empSkill = emp.employeeSkills.find((es) => es.skillId === req.skillId);
      const current = empSkill?.validatedLevel ?? 0;
      const met = current >= req.requiredLevel;
      if (met) skillCoverage++;
      else unmet.push(req.skillName);
      skillDepth += Math.min(current / req.requiredLevel, 1);
      breakdown.push({ skillName: req.skillName, required: req.requiredLevel, current, met });
    }

    const coveragePct = requiredSkills.length > 0 ? skillCoverage / requiredSkills.length : 0;
    const depthPct = requiredSkills.length > 0 ? skillDepth / requiredSkills.length : 0;
    const skillScore = Math.round((coveragePct * 0.6 + depthPct * 0.4) * 100);

    // ── Competency Score ─────────────────────────────────────
    // Average of all 5 consulting behaviour scores (max 5 → normalise to 100)
    const competencyScore = emp.competencies.length > 0
      ? Math.round((emp.competencies.reduce((s, c) => s + c.score, 0) / emp.competencies.length / 5) * 100)
      : 50; // default when no competency data

    // ── Availability Fit ─────────────────────────────────────
    const usedPct = emp.allocations.reduce((sum, a) => sum + a.allocation, 0);
    const availableFTE = Math.max(0, (100 - usedPct) / 100);
    const availabilityFit = Math.round(Math.min(availableFTE, 1) * 100);

    // ── Billability Fit ──────────────────────────────────────
    // Converting bench/unbillable to billable on this project = high fit
    const snapshots = emp.utilisationSnapshots;
    const avgBillable = snapshots.length > 0
      ? snapshots.reduce((s, sn) => s + sn.billableUtil, 0) / snapshots.length
      : 1;
    // Low current billability → high billability fit (opportunity to recover cost)
    const billabilityFit = Math.round((1 - avgBillable) * 100);

    // ── Evidence Strength ────────────────────────────────────
    const totalEvidence = emp.employeeSkills.reduce((s, es) => s + es.evidences.length, 0);
    const evidenceStrength = Math.min(totalEvidence * 10, 100);

    // ── Weighted Match Score ─────────────────────────────────
    const matchScore = Math.round(
      skillScore * MATCH_WEIGHTS.skill +
      competencyScore * MATCH_WEIGHTS.competency +
      availabilityFit * MATCH_WEIGHTS.availability +
      billabilityFit * MATCH_WEIGHTS.billability +
      evidenceStrength * MATCH_WEIGHTS.evidence,
    );

    // ── Signal ───────────────────────────────────────────────
    let signal: MatchSignal = "REDEPLOY";
    if (coveragePct < 0.7 || skillScore < 60 || availableFTE === 0) {
      signal = coveragePct < 0.4 ? "HIRE" : "PARTIAL_HIRE";
    }

    return {
      employeeId: emp.id,
      name: emp.name,
      jobName: emp.jobName,
      skillScore,
      competencyScore,
      availabilityFit,
      billabilityFit,
      evidenceStrength,
      matchScore,
      skillBreakdown: breakdown,
      unmetSkills: unmet,
      availableFTE,
      signal,
    };
  });

  return results
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, topN);
}
