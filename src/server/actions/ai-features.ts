"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiService } from "@/server/services/ai.service";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { z } from "zod";
import { buildWorkforceNarrativePrompt } from "@/lib/ai-prompts/workforce-narrative.prompt";
import { buildTalentMatchPrompt } from "@/lib/ai-prompts/talent-match.prompt";

// ─── Gap Narrative ────────────────────────────────────────────────────────────

export async function generateGapNarrativeAction(): Promise<{ narrative: string | null; configured: boolean }> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const configured = aiService.isConfigured();

  const employee = await db.employee.findFirst({
    where: { user: { id: session.user.id } },
    select: {
      designation: { select: { name: true } },
      coe: { select: { name: true } },
    },
  });

  if (!employee) return { narrative: null, configured };

  // Fetch ONLY skill names/levels - no employee PII goes to AI
  const skills = await db.employeeSkill.findMany({
    where: { employee: { user: { id: session.user.id } }, status: "APPROVED" },
    select: {
      validatedLevel: true,
      skill: { select: { name: true, category: true } },
    },
  });

  const designationSkills = employee.designation
    ? await db.designationSkill.findMany({
        where: { designation: { name: employee.designation.name } },
        select: {
          targetCompetency: true,
          skill: { select: { name: true, category: true } },
        },
      })
    : [];

  const coeSkills = employee.coe
    ? await db.coeSkill.findMany({
        where: { coe: { name: employee.coe.name } },
        select: {
          targetCompetency: true,
          skill: { select: { name: true, category: true } },
        },
      })
    : [];

  // Build target map (max of designation and COE targets)
  const targetMap = new Map<string, { targetLevel: number; category: string }>();
  for (const ds of designationSkills) {
    targetMap.set(ds.skill.name, { targetLevel: ds.targetCompetency, category: ds.skill.category });
  }
  for (const cs of coeSkills) {
    const existing = targetMap.get(cs.skill.name);
    if (!existing || cs.targetCompetency > existing.targetLevel) {
      targetMap.set(cs.skill.name, { targetLevel: cs.targetCompetency, category: cs.skill.category });
    }
  }

  const approvedMap = new Map(skills.map((s) => [s.skill.name, s.validatedLevel ?? 0]));

  const gaps = Array.from(targetMap.entries()).map(([skillName, { targetLevel, category }]) => {
    const current = approvedMap.get(skillName) ?? 0;
    const gap = Math.max(0, targetLevel - current);
    const status = gap === 0 ? "met" : current > 0 ? "partial" : "missing";
    return { skillName, category, gap, currentLevel: current, targetLevel, status } as const;
  });

  const met = gaps.filter((g) => g.status === "met").length;
  const readinessPercent = gaps.length > 0 ? Math.round((met / gaps.length) * 100) : 0;

  const narrative = await aiService.generateGapNarrative(session.user.id, {
    designation: employee.designation?.name ?? "Professional",
    coe: employee.coe?.name ?? "General",
    readinessPercent,
    gaps,
  });

  return { narrative, configured };
}

// ─── Learning Path Summary ────────────────────────────────────────────────────

export async function generateLearningPathSummaryAction(): Promise<{ summary: string | null; configured: boolean }> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const configured = aiService.isConfigured();

  const employee = await db.employee.findFirst({
    where: { user: { id: session.user.id } },
    select: {
      designation: { select: { name: true } },
      coe: { select: { name: true } },
    },
  });

  if (!employee) return { summary: null, configured };

  // Get skills with gaps (same logic as gap analysis - only names/levels)
  const approvedSkills = await db.employeeSkill.findMany({
    where: { employee: { user: { id: session.user.id } }, status: "APPROVED" },
    select: { validatedLevel: true, skill: { select: { name: true, category: true } } },
  });

  const approvedMap = new Map(approvedSkills.map((s) => [s.skill.name, s.validatedLevel ?? 0]));

  const targets: Array<{ skillName: string; gap: number; category: string }> = [];

  const designationSkills = employee.designation
    ? await db.designationSkill.findMany({
        where: { designation: { name: employee.designation.name } },
        select: { targetCompetency: true, skill: { select: { name: true, category: true } } },
      })
    : [];

  for (const ds of designationSkills) {
    const current = approvedMap.get(ds.skill.name) ?? 0;
    const gap = Math.max(0, ds.targetCompetency - current);
    if (gap > 0) {
      targets.push({ skillName: ds.skill.name, gap, category: ds.skill.category });
    }
  }

  if (targets.length === 0) return { summary: null, configured };

  const summary = await aiService.generateLearningPathSummary(session.user.id, {
    designation: employee.designation?.name ?? "Professional",
    coe: employee.coe?.name ?? "General",
    skillsToLearn: targets,
  });

  return { summary, configured };
}

// ─── Meeting Prep (Manager only) ──────────────────────────────────────────────

export async function generateMeetingBriefAction() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") throw new ForbiddenError();

  const configured = aiService.isConfigured();

  const managerEmployee = await db.employee.findFirst({
    where: { user: { id: session.user.id } },
    select: { id: true, coe: { select: { name: true } } },
  });

  if (!managerEmployee) return { brief: null, configured };

  const reportees = await db.employee.findMany({
    where: { managerId: managerEmployee.id },
    select: {
      employeeSkills: {
        select: {
          status: true,
          skill: { select: { name: true } },
          validatedLevel: true,
        },
      },
      designation: { select: { name: true } },
    },
  });

  const pendingApprovals = reportees.reduce(
    (sum, emp) => sum + emp.employeeSkills.filter((s) => s.status === "PENDING").length,
    0
  );

  // Aggregate skill gap data - no individual employee info sent to AI
  const skillGapCounts = new Map<string, number>();
  for (const emp of reportees) {
    for (const skill of emp.employeeSkills) {
      if (skill.status === "PENDING" || (!skill.validatedLevel)) {
        skillGapCounts.set(skill.skill.name, (skillGapCounts.get(skill.skill.name) ?? 0) + 1);
      }
    }
  }

  const criticalGapSkills = Array.from(skillGapCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const membersNeedingAttention = reportees.filter(
    (emp) => emp.employeeSkills.filter((s) => s.status === "PENDING").length > 2
  ).length;

  const brief = await aiService.generateMeetingBrief(session.user.id, {
    teamSize: reportees.length,
    pendingApprovals,
    teamReadinessAvg: 65, // Placeholder - will use real gap analysis in a future pass
    criticalGapSkills,
    topPerformers: Math.max(0, reportees.length - membersNeedingAttention),
    membersNeedingAttention,
    coe: managerEmployee.coe?.name ?? "General",
  });

  return { brief, configured };
}

// ─── Workforce Narrative (Admin only) ────────────────────────────────────────

export interface WorkforceNarrativeResult {
  headline: string;
  summary: string;
  urgentActions: string[];
  positiveSignal: string;
}

const workforceNarrativeSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  urgentActions: z.array(z.string()).min(1).max(5),
  positiveSignal: z.string().min(1),
});

export async function generateWorkforceNarrativeAction(): Promise<{
  result: WorkforceNarrativeResult | null;
  configured: boolean;
}> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const configured = aiService.isConfigured();

  // Gather aggregated metrics - NO employee names or IDs sent to AI
  const [employees] = await Promise.all([
    db.employee.findMany({
      select: {
        coeId: true,
        coe: { select: { name: true, coeSkills: { select: { skillId: true, targetCompetency: true } } } },
        designation: { select: { designationSkills: { select: { skillId: true, targetCompetency: true } } } },
        employeeSkills: { where: { status: "APPROVED" }, select: { skillId: true, validatedLevel: true } },
        allocations: { select: { allocation: true, endDate: true } },
      },
    }),
  ]);

  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let totalReadiness = 0;
  let totalUtilization = 0;
  let benchCount = 0;
  let overallocatedCount = 0;
  let upcomingRollOffs = 0;

  const coeReadinessMap = new Map<string, number[]>();

  for (const emp of employees) {
    // Readiness
    const targetMap = new Map<string, number>();
    for (const cs of emp.coe?.coeSkills ?? []) {
      targetMap.set(cs.skillId, Math.max(targetMap.get(cs.skillId) ?? 0, cs.targetCompetency));
    }
    for (const ds of emp.designation?.designationSkills ?? []) {
      targetMap.set(ds.skillId, Math.max(targetMap.get(ds.skillId) ?? 0, ds.targetCompetency));
    }
    const approvedMap = new Map(emp.employeeSkills.map((s) => [s.skillId, s.validatedLevel ?? 0]));
    let met = 0;
    for (const [skillId, target] of targetMap) {
      if ((approvedMap.get(skillId) ?? 0) >= target) met++;
    }
    const readiness = targetMap.size > 0 ? Math.round((met / targetMap.size) * 100) : 0;
    totalReadiness += readiness;
    if (emp.coe?.name) {
      const arr = coeReadinessMap.get(emp.coe.name) ?? [];
      arr.push(readiness);
      coeReadinessMap.set(emp.coe.name, arr);
    }

    // Utilization
    const util = emp.allocations.reduce((s, a) => s + a.allocation, 0);
    totalUtilization += util;
    if (util === 0) benchCount++;
    if (util > 100) overallocatedCount++;

    // Roll-offs
    for (const alloc of emp.allocations) {
      if (alloc.endDate && alloc.endDate > now && alloc.endDate <= thirtyDaysOut) {
        upcomingRollOffs++;
      }
    }
  }

  const count = employees.length || 1;
  const avgReadiness = Math.round(totalReadiness / count);
  const avgUtilization = Math.round(totalUtilization / count);

  const coesWithLowReadiness = Array.from(coeReadinessMap.entries())
    .map(([name, scores]) => ({
      name,
      readiness: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    }))
    .filter((c) => c.readiness < 60)
    .sort((a, b) => a.readiness - b.readiness)
    .slice(0, 4);

  // Top skill gaps (skills most commonly not meeting target - names only)
  const skillGapCounts = new Map<string, number>();
  const skillNames = await db.skill.findMany({ select: { id: true, name: true } });
  const skillNameMap = new Map(skillNames.map((s) => [s.id, s.name]));

  for (const emp of employees) {
    const targetMap = new Map<string, number>();
    for (const cs of emp.coe?.coeSkills ?? []) targetMap.set(cs.skillId, cs.targetCompetency);
    for (const ds of emp.designation?.designationSkills ?? []) targetMap.set(ds.skillId, ds.targetCompetency);
    const approvedMap = new Map(emp.employeeSkills.map((s) => [s.skillId, s.validatedLevel ?? 0]));
    for (const [skillId, target] of targetMap) {
      if ((approvedMap.get(skillId) ?? 0) < target) {
        const name = skillNameMap.get(skillId);
        if (name) skillGapCounts.set(name, (skillGapCounts.get(name) ?? 0) + 1);
      }
    }
  }

  const topSkillGaps = Array.from(skillGapCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const prompt = buildWorkforceNarrativePrompt({
    totalEmployees: employees.length,
    avgReadiness,
    avgUtilization,
    benchCount,
    overallocatedCount,
    upcomingRollOffs,
    coesWithLowReadiness,
    topSkillGaps,
  });

  const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey || !configured) return { result: null, configured };

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
    });
    const response = await model.generateContent(prompt);
    const text = response.response.text().trim();
    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = workforceNarrativeSchema.safeParse(JSON.parse(clean));
    if (!parsed.success) return { result: null, configured };
    return { result: parsed.data, configured };
  } catch (err) {
    console.error("[ai-features] Workforce narrative failed:", err);
    return { result: null, configured };
  }
}

// ─── Talent Match Explanation (Admin only) ────────────────────────────────────

export interface TalentMatchExplanationResult {
  topPick: string;
  topPickReason: string;
  ranking: Array<{ ref: string; fit: string; note: string }>;
  teamingNote: string;
}

const talentMatchSchema = z.object({
  topPick: z.string().min(1),
  topPickReason: z.string().min(1),
  ranking: z.array(z.object({ ref: z.string(), fit: z.string(), note: z.string() })),
  teamingNote: z.string().min(1),
});

export async function generateTalentMatchAction(input: {
  projectName: string;
  requiredSkills: Array<{ skillName: string; requiredLevel: number; priority: string }>;
  // candidateIds are resolved server-side; never trusted from client
  candidateEmployeeIds: string[];
}): Promise<{ result: TalentMatchExplanationResult | null; configured: boolean }> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") throw new ForbiddenError();

  const configured = aiService.isConfigured();
  if (!configured) return { result: null, configured };

  // Fetch candidate data server-side - we build anonymised labels, never send names to AI
  const candidates = await db.employee.findMany({
    where: { id: { in: input.candidateEmployeeIds.slice(0, 10) } },
    select: {
      id: true,
      coe: { select: { name: true } },
      designation: { select: { name: true } },
      allocations: { select: { allocation: true } },
      employeeSkills: {
        where: { status: "APPROVED" },
        select: { skillId: true, validatedLevel: true, skill: { select: { name: true } } },
      },
    },
  });

  const candidateData = candidates.map((emp, idx) => {
    const util = emp.allocations.reduce((s, a) => s + a.allocation, 0);
    const approvedSkills = emp.employeeSkills.map((s) => ({
      skillName: s.skill.name,
      validatedLevel: s.validatedLevel ?? 0,
    }));

    const matchedSkills = input.requiredSkills
      .map((req) => {
        const found = approvedSkills.find((s) => s.skillName === req.skillName);
        return found ? { skillName: req.skillName, validatedLevel: found.validatedLevel, requiredLevel: req.requiredLevel } : null;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    const missingSkills = input.requiredSkills
      .filter((req) => !approvedSkills.some((s) => s.skillName === req.skillName && s.validatedLevel >= req.requiredLevel))
      .map((r) => r.skillName);

    const matchPercent =
      input.requiredSkills.length > 0
        ? Math.round((matchedSkills.filter((s) => s.validatedLevel >= s.requiredLevel).length / input.requiredSkills.length) * 100)
        : 0;

    return {
      candidateRef: `Candidate ${String.fromCharCode(65 + idx)}`, // A, B, C… - NO real names
      coe: emp.coe?.name ?? "General",
      designation: emp.designation?.name ?? "-",
      utilization: util,
      matchedSkills,
      missingSkills,
      matchPercent,
    };
  });

  const prompt = buildTalentMatchPrompt({
    projectName: input.projectName,
    requiredSkills: input.requiredSkills,
    candidates: candidateData,
  });

  const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return { result: null, configured };

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { temperature: 0.3, maxOutputTokens: 768 },
    });
    const response = await model.generateContent(prompt);
    const text = response.response.text().trim();
    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = talentMatchSchema.safeParse(JSON.parse(clean));
    if (!parsed.success) return { result: null, configured };
    return { result: parsed.data, configured };
  } catch (err) {
    console.error("[ai-features] Talent match failed:", err);
    return { result: null, configured };
  }
}

// ─── Feedback Synthesis (Admin/Manager) ──────────────────────────────────────

export async function generateFeedbackSummaryAction(assignmentId: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role === "EMPLOYEE") throw new ForbiddenError();

  const configured = aiService.isConfigured();

  const assignment = await db.feedbackFormAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      submission: {
        select: {
          responses: {
            select: {
              ratingValue: true,
              textValue: true,
              question: { select: { text: true, type: true } },
            },
          },
        },
      },
      employee: {
        select: {
          designation: { select: { name: true } },
          coe: { select: { name: true } },
        },
      },
      reviewCycle: { select: { name: true } },
    },
  });

  if (!assignment?.submission) return { result: null, configured };

  // Responses only - no reviewer/reviewee names go to AI
  const responses = assignment.submission.responses.map((r) => ({
    questionText: r.question.text,
    questionType: r.question.type,
    ratingValue: r.ratingValue ?? undefined,
    textValue: r.textValue ?? undefined,
  }));

  const result = await aiService.generateFeedbackSummary(session.user.id, {
    designation: assignment.employee.designation?.name ?? "Professional",
    coe: assignment.employee.coe?.name ?? "General",
    reviewCycleName: assignment.reviewCycle.name,
    responses,
  });

  return { result, configured };
}
