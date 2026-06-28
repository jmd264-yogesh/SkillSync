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
  employeeId: string;   // internal UUID — use as React key / pool-depletion tracking
  employeeCode: string; // business key (employee_code) — primary display identifier
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
  /** Canonical role names from normalizeResourceRequest — filters by jobName (OR match). */
  canonicalRoles?: string[];
  windowStart?: Date;
  windowEnd?: Date;
  topN?: number;
}): Promise<MatchResult[]> {
  const { requiredSkills, canonicalRoles, windowStart, windowEnd, topN = 20 } = params;
  const hasSkillFilter = requiredSkills.length > 0;
  const hasRoleFilter = canonicalRoles && canonicalRoles.length > 0;
  const skillIds = requiredSkills.map((s) => s.skillId);

  // Build role filter: match jobName against any canonical role (case-insensitive contains)
  const roleWhere = hasRoleFilter
    ? { OR: canonicalRoles!.map((r) => ({ jobName: { contains: r } })) }
    : {};

  const employees = await db.employee.findMany({
    where: roleWhere,
    include: {
      employeeSkills: {
        // When no skill filter, still load approved skills for evidence strength calc
        where: hasSkillFilter ? { status: "APPROVED", skillId: { in: skillIds } } : { status: "APPROVED" },
        include: { skill: true, evidences: true },
      },
      competencies: true,
      allocations: {
        where: { project: { status: { notIn: ["COMPLETED"] } } },
        include: { project: { select: { status: true } } },
      },
      utilisationSnapshots: { orderBy: { weekStart: "desc" }, take: 4 },
      experienceDocs: {
        where: { extractionStatus: { in: ["EXTRACTED", "APPLIED"] } },
        select: { techStack: true, extractedSkills: true },
      },
    },
  });

  const results: MatchResult[] = employees.map((emp) => {
    // ── Skill Score ──────────────────────────────────────────
    let skillCoverage = 0;
    let skillDepth = 0;
    let coveragePct = 1; // no skill filter = 100% coverage by definition
    const breakdown: SkillBreakdown[] = [];
    const unmet: string[] = [];

    if (hasSkillFilter) {
      for (const req of requiredSkills) {
        const empSkill = emp.employeeSkills.find((es) => es.skillId === req.skillId);
        const current = empSkill?.validatedLevel ?? 0;
        const met = current >= req.requiredLevel;
        if (met) skillCoverage++;
        else unmet.push(req.skillName);
        skillDepth += Math.min(current / req.requiredLevel, 1);
        breakdown.push({ skillName: req.skillName, required: req.requiredLevel, current, met });
      }
      coveragePct = skillCoverage / requiredSkills.length;
    }

    const depthPct = hasSkillFilter && requiredSkills.length > 0 ? skillDepth / requiredSkills.length : 1;
    const skillScore = hasSkillFilter
      ? Math.round((coveragePct * 0.6 + depthPct * 0.4) * 100)
      : Math.round((emp.employeeSkills.length > 0 ? Math.min(emp.employeeSkills.length / 5, 1) : 0.3) * 100);

    // ── Competency Score ─────────────────────────────────────
    // Average of all 5 consulting behaviour scores (max 5 → normalise to 100)
    const competencyScore = emp.competencies.length > 0
      ? Math.round((emp.competencies.reduce((s, c) => s + c.score, 0) / emp.competencies.length / 5) * 100)
      : 50; // default when no competency data

    // ── Availability Fit ─────────────────────────────────────
    // Use snapshot utilisation as the primary availability signal.
    // Allocation sums are unreliable when employees appear on many historical projects.
    const snapshots = emp.utilisationSnapshots;
    const avgUtil = snapshots.length > 0
      ? snapshots.reduce((s, sn) => s + sn.utilisation, 0) / snapshots.length
      : (emp.allocations.length > 0 ? 1.0 : 0); // fallback: active projects → fully utilised
    const availableFTE = Math.max(0, 1 - avgUtil);
    const availabilityFit = Math.round(Math.min(availableFTE, 1) * 100);

    // ── Billability Fit ──────────────────────────────────────
    const avgBillable = snapshots.length > 0
      ? snapshots.reduce((s, sn) => s + sn.billableUtil, 0) / snapshots.length
      : 1;
    // Low current billability → high billability fit (opportunity to recover cost)
    const billabilityFit = Math.round((1 - avgBillable) * 100);

    // ── Evidence Strength ────────────────────────────────────
    const totalEvidence = emp.employeeSkills.reduce((s, es) => s + es.evidences.length, 0);
    // Boost for project experience docs whose tech stack / extracted skills overlap with required skills
    const reqNames = new Set(requiredSkills.map((r) => r.skillName.toLowerCase()));
    let expBoost = 0;
    for (const doc of emp.experienceDocs) {
      const techTerms = (doc.techStack ?? "").split(/[,;]/).map((t) => t.trim().toLowerCase());
      let docExtracted: { name: string }[] = [];
      try { docExtracted = doc.extractedSkills ? (JSON.parse(doc.extractedSkills) as { name: string }[]) : []; } catch { /* ignore */ }
      const docSkillNames = [...techTerms, ...docExtracted.map((s) => s.name.toLowerCase())];
      if (docSkillNames.some((n) => reqNames.has(n))) expBoost += 15;
    }
    const evidenceStrength = Math.min(totalEvidence * 10 + expBoost, 100);

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
    if (!hasSkillFilter) {
      // Availability-only mode: signal based purely on free capacity
      signal = availableFTE > 0.5 ? "REDEPLOY" : availableFTE > 0.1 ? "PARTIAL_HIRE" : "HIRE";
    } else if (coveragePct < 0.7 || skillScore < 60 || availableFTE === 0) {
      signal = coveragePct < 0.4 ? "HIRE" : "PARTIAL_HIRE";
    }

    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
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
