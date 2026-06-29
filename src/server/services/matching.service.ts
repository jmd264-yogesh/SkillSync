import { db } from "@/lib/db";
import { MATCH_WEIGHTS } from "@/lib/constants";

export type MatchSignal = "REDEPLOY" | "HIRE" | "PARTIAL_HIRE";

export type RiskFlag =
  | "LEAVER"
  | "OVER_ALLOCATED"
  | "GHOST"
  | "SKILL_GAP_FOR_ROLE"
  | "ON_LEAVE"
  | "UNDER_LEVELLED"
  | "LOW_EXPERIENCE";

export interface SkillBreakdown {
  skillName: string;
  required: number;
  current: number;
  met: boolean;
}

export interface MatchResult {
  employeeId: string;
  employeeCode: string;
  name: string;
  jobName: string | null;
  location: string | null;
  // Scores
  skillScore: number;
  competencyScore: number;
  availabilityFit: number;
  billabilityFit: number;
  evidenceStrength: number;
  matchScore: number;
  // Skill details
  skillBreakdown: SkillBreakdown[];
  unmetSkills: string[];
  availableFTE: number;
  signal: MatchSignal;
  // Designation & cluster
  designationName: string | null;
  designationLevel: number | null;
  coeName: string | null;
  // Availability signals
  noticeDaysRemaining: number | null;   // null = not resigning
  plannedLeaveDays: number;             // total leave days in next 90 days
  // Track record
  previousClients: string[];            // distinct project/client names from allocations
  totalProjects: number;
  // Risk
  riskFlags: RiskFlag[];
}

export async function computeMatchRanking(params: {
  requiredSkills: { skillId: string; skillName: string; requiredLevel: number }[];
  canonicalRoles?: string[];
  windowStart?: Date;
  windowEnd?: Date;
  topN?: number;
}): Promise<MatchResult[]> {
  const { requiredSkills, canonicalRoles, windowStart, windowEnd, topN = 20 } = params;
  const hasSkillFilter = requiredSkills.length > 0;
  const hasRoleFilter = canonicalRoles && canonicalRoles.length > 0;
  const skillIds = requiredSkills.map((s) => s.skillId);

  const roleWhere = hasRoleFilter
    ? { OR: canonicalRoles!.map((r) => ({ jobName: { contains: r } })) }
    : {};

  const now = new Date();
  const leaveHorizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const projectWindow = {
    start: windowStart ?? now,
    end: windowEnd ?? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
  };

  const employees = await db.employee.findMany({
    where: roleWhere,
    include: {
      designation: { select: { name: true, level: true } },
      coe:         { select: { name: true } },
      employeeSkills: {
        where: hasSkillFilter
          ? { status: "APPROVED", skillId: { in: skillIds } }
          : { status: "APPROVED" },
        include: { skill: true, evidences: true },
      },
      competencies: true,
      allocations: {
        include: {
          project: {
            select: { status: true, name: true, clientId: true, category: true },
          },
        },
      },
      shadowFlags: {
        where: { flagType: "GHOST" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      utilisationSnapshots: { orderBy: { weekStart: "desc" }, take: 4 },
      leaves: {
        where: { startDate: { lte: leaveHorizon }, endDate: { gte: now } },
        select: { startDate: true, endDate: true, type: true },
      },
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
    let coveragePct = 1;
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
    const competencyScore = emp.competencies.length > 0
      ? Math.round((emp.competencies.reduce((s, c) => s + c.score, 0) / emp.competencies.length / 5) * 100)
      : 50;

    // ── Availability Fit ─────────────────────────────────────
    const activeAllocations = emp.allocations.filter((a) => a.project.status !== "COMPLETED");
    const snapshots = emp.utilisationSnapshots;
    const avgUtil = snapshots.length > 0
      ? snapshots.reduce((s, sn) => s + sn.utilisation, 0) / snapshots.length
      : (activeAllocations.length > 0 ? 1.0 : 0);
    const availableFTE = Math.max(0, 1 - avgUtil);
    const availabilityFit = Math.round(Math.min(availableFTE, 1) * 100);

    // ── Billability Fit ──────────────────────────────────────
    const avgBillable = snapshots.length > 0
      ? snapshots.reduce((s, sn) => s + sn.billableUtil, 0) / snapshots.length
      : 1;
    const billabilityFit = Math.round((1 - avgBillable) * 100);

    // ── Evidence Strength ────────────────────────────────────
    const totalEvidence = emp.employeeSkills.reduce((s, es) => s + es.evidences.length, 0);
    const reqNames = new Set(requiredSkills.map((r) => r.skillName.toLowerCase()));
    let expBoost = 0;
    for (const doc of emp.experienceDocs) {
      const techTerms = (doc.techStack ?? "").split(/[,;]/).map((t) => t.trim().toLowerCase());
      let docExtracted: { name: string }[] = [];
      try { docExtracted = doc.extractedSkills ? (JSON.parse(doc.extractedSkills) as { name: string }[]) : []; } catch { /* ignore */ }
      const docSkillNames = [...techTerms, ...docExtracted.map((s) => s.name.toLowerCase())];
      if (docSkillNames.some((n) => reqNames.has(n))) expBoost += 15;
    }
    if (canonicalRoles && canonicalRoles.length > 0) {
      const hasRoleHistory = emp.allocations.some((alloc) => {
        const roleToCheck = alloc.role ?? emp.jobName ?? "";
        if (!roleToCheck) return false;
        const roleLower = roleToCheck.toLowerCase();
        return canonicalRoles!.some(
          (cr) => roleLower.includes(cr.toLowerCase()) || cr.toLowerCase().includes(roleLower),
        );
      });
      if (hasRoleHistory) expBoost += 15;
    }
    const distinctProjectCount = new Set(emp.allocations.map((a) => a.projectId)).size;
    expBoost += Math.min(distinctProjectCount * 4, 20);
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
      signal = availableFTE > 0.5 ? "REDEPLOY" : availableFTE > 0.1 ? "PARTIAL_HIRE" : "HIRE";
    } else if (coveragePct < 0.7 || skillScore < 60 || availableFTE === 0) {
      signal = coveragePct < 0.4 ? "HIRE" : "PARTIAL_HIRE";
    }

    // ── Notice Period ─────────────────────────────────────────
    const noticeDaysRemaining = emp.dateOfResignation
      ? Math.max(0, Math.round((emp.dateOfResignation.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    // ── Planned Leave ─────────────────────────────────────────
    let plannedLeaveDays = 0;
    for (const leave of emp.leaves) {
      const s = leave.startDate.getTime();
      const e = leave.endDate.getTime();
      const winS = projectWindow.start.getTime();
      const winE = projectWindow.end.getTime();
      const overlapStart = Math.max(s, winS);
      const overlapEnd = Math.min(e, winE);
      if (overlapEnd > overlapStart) {
        plannedLeaveDays += Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));
      }
    }

    // ── Previous Clients ─────────────────────────────────────
    const previousClients = [
      ...new Set(
        emp.allocations
          .map((a) => a.project.clientId ?? a.project.name)
          .filter((c): c is string => Boolean(c)),
      ),
    ].slice(0, 5);

    // ── Risk Flags ────────────────────────────────────────────
    const riskFlags: RiskFlag[] = [];
    if (noticeDaysRemaining !== null && noticeDaysRemaining <= 60) riskFlags.push("LEAVER");
    if (avgUtil > 1.0) riskFlags.push("OVER_ALLOCATED");
    if (emp.shadowFlags.length > 0) riskFlags.push("GHOST");
    if (hasSkillFilter && coveragePct < 0.5) riskFlags.push("SKILL_GAP_FOR_ROLE");
    if (plannedLeaveDays > 10) riskFlags.push("ON_LEAVE");
    // Under-levelled: designation level compared against rough role expectation
    const desigLevel = emp.designation?.level ?? null;
    if (desigLevel !== null && hasSkillFilter && skillScore < 40 && desigLevel < 3) {
      riskFlags.push("UNDER_LEVELLED");
    }
    // Low experience: no ExperienceDocs with meaningful skill data
    const hasExpData = emp.experienceDocs.some((d) => d.extractedSkills && d.extractedSkills !== "[]");
    if (!hasExpData && emp.employeeSkills.length === 0) riskFlags.push("LOW_EXPERIENCE");

    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      name: emp.name,
      jobName: emp.jobName,
      location: emp.location,
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
      designationName: emp.designation?.name ?? null,
      designationLevel: emp.designation?.level ?? null,
      coeName: emp.coe?.name ?? null,
      noticeDaysRemaining,
      plannedLeaveDays,
      previousClients,
      totalProjects: distinctProjectCount,
      riskFlags,
    };
  });

  return results
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, topN);
}
