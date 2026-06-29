import { SchemaType } from "@google/generative-ai";
import type { Tool } from "@google/generative-ai";
import type { ProjectCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { forecastNewProjects } from "@/server/services/forecast.service";
import { computeMatchRanking } from "@/server/services/matching.service";
import { normalizeResourceRequest } from "@/lib/role-mapping";
import { getProjectHealth } from "@/server/services/health.service";
import { runAgent } from "./runtime";
import { GUARDRAIL_NOTE } from "./guardrails";
import type { AgentStep } from "./guardrails";
import type { NewProjectForecast } from "@/server/services/forecast.service";

export interface PlanAssignment {
  role: string;
  type: "REDEPLOY" | "HIRE";
  employeeId?: string;
  employeeName?: string;
  fitScore?: number;
  riskNote?: string;
}

export interface StaffingPlan {
  planName: string;
  tradeoffSummary: string;
  hireCount: number;
  redeployCount: number;
  residualShortfall: number;
  riskFlags: string[];
  assignments: PlanAssignment[];
  decisionVariant: "YES" | "YES_WITH_CONDITIONS" | "NO";
}

export interface StaffingPlanResult {
  plans: StaffingPlan[];
  narrative: string;
  trace: AgentStep[];
  fallbackForecast: NewProjectForecast;
}

const SYSTEM = `You are a staffing planner for a professional services firm. Your job is to produce
2–3 DISTINCT conflict-checked staffing plans for a set of new projects.

MANDATORY SEQUENCE:
1. Call get_demand to understand role requirements and shortfalls.
2. For each role with shortfall > 0, call find_candidates to get the top internal candidates.
3. For the top 2–3 redeployment candidates you are considering, call check_health_impact.
   - If safe=false (CONFLICT), do NOT use that person in the safe plan. Try the next candidate.
   - Explicitly note the backtrack in your reasoning.
4. Call record_plan 2–3 times for distinct variants:
   - "Plan A - Redeploy-Heavy": maximize redeployments (include risky ones, flag the risk)
   - "Plan B - Delivery-Safe": only safe redeployments, hire for any conflicting roles
   - "Plan C - Balanced" (optional): mix of partial hire + partial redeploy
5. After recording all plans, return a 2-sentence comparison.

${GUARDRAIL_NOTE}`;

const PLAN_BUILDER_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "get_demand",
        description:
          "Get role demand forecast for the new projects. Returns demand FTE per role, total shortfall, and available redeployment candidate count.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: "find_candidates",
        description:
          "Find ranked internal candidates for a role by availability and match score. Returns up to topN employees.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            role: {
              type: SchemaType.STRING,
              description: "Job name / role title (partial match, e.g. 'Consultant', 'Analyst')",
            },
            topN: {
              type: SchemaType.NUMBER,
              description: "Max candidates to return (default 5, max 8)",
            },
          },
          required: ["role"],
        },
      },
      {
        name: "check_health_impact",
        description:
          "Check whether redeploying an employee would worsen a RED-flagged active project they are on. Returns {safe: bool, conflicts: [{projectName, flags}]}. If safe=false, consider a different candidate.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            employeeId: {
              type: SchemaType.STRING,
              description: "Employee UUID from find_candidates result",
            },
            employeeName: {
              type: SchemaType.STRING,
              description: "Employee name (for trace log)",
            },
          },
          required: ["employeeId"],
        },
      },
      {
        name: "record_plan",
        description:
          "Record a complete staffing plan variant. Call once per plan (Plan A, Plan B, etc.).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            planName: { type: SchemaType.STRING },
            tradeoffSummary: { type: SchemaType.STRING },
            hireCount: { type: SchemaType.NUMBER },
            redeployCount: { type: SchemaType.NUMBER },
            residualShortfall: { type: SchemaType.NUMBER },
            riskFlags: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
            assignments: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  role: { type: SchemaType.STRING },
                  type: {
                    type: SchemaType.STRING,
                    description: "REDEPLOY or HIRE",
                  },
                  employeeId: { type: SchemaType.STRING },
                  employeeName: { type: SchemaType.STRING },
                  fitScore: { type: SchemaType.NUMBER },
                  riskNote: { type: SchemaType.STRING },
                },
                required: ["role", "type"],
              },
            },
          },
          required: [
            "planName",
            "tradeoffSummary",
            "hireCount",
            "redeployCount",
            "residualShortfall",
            "assignments",
          ],
        },
      },
    ],
  },
];

function derivePlanVariant(
  hireCount: number,
  residualShortfall: number,
  riskFlags: string[],
): StaffingPlan["decisionVariant"] {
  if (residualShortfall > 1) return "NO";
  if (hireCount > 0 || riskFlags.length > 0) return "YES_WITH_CONDITIONS";
  return "YES";
}

function buildFallbackPlans(forecast: NewProjectForecast): StaffingPlan[] {
  const hires = Math.ceil(forecast.totalShortfall);
  const redeploys = Math.min(forecast.reallocationCandidates.length, 5);
  return [
    {
      planName: "Plan A - Available Redeployments",
      tradeoffSummary: `Redeploy ${redeploys} available employees; hire ${hires} for residual shortfall.`,
      hireCount: hires,
      redeployCount: redeploys,
      residualShortfall: Math.max(0, forecast.totalShortfall - redeploys),
      riskFlags: [],
      assignments: forecast.reallocationCandidates.slice(0, 5).map((c) => ({
        role: c.role ?? "Unknown",
        type: "REDEPLOY" as const,
        employeeId: c.employeeId,
        employeeName: c.name,
        fitScore: Math.round(c.freeCapacity * 100),
      })),
      decisionVariant: forecast.totalShortfall > 0 ? "YES_WITH_CONDITIONS" : "YES",
    },
  ];
}

export async function buildStaffingPlans(
  input: { category: ProjectCategory; count: number; start: Date; weeks: number }[],
): Promise<StaffingPlanResult> {
  // Pre-compute demand deterministically - used as context AND as fallback
  const fallbackForecast = await forecastNewProjects({ adHoc: input });
  const capturedPlans: StaffingPlan[] = [];

  async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === "get_demand") {
      return {
        byRole: fallbackForecast.byRole.slice(0, 8).map((r) => ({
          role: r.role,
          demandFTE: r.demandFTE,
          supplyFTE: r.supplyFTE,
          shortfall: r.shortfall,
        })),
        totalDemandFTE: fallbackForecast.totalDemandFTE,
        totalShortfall: fallbackForecast.totalShortfall,
        redeploymentCandidateCount: fallbackForecast.reallocationCandidates.length,
      };
    }

    if (name === "find_candidates") {
      const role = String(args["role"] ?? "");
      const topN = Math.min(Number(args["topN"] ?? 5), 8);
      // Use canonical role mapping so "SC" → Senior Consultant, "AP/P" → both grades, etc.
      const parsed = role.length > 0 ? normalizeResourceRequest(role) : { canonicalRoles: [] };
      const canonicalRoles = parsed.canonicalRoles.length > 0 ? parsed.canonicalRoles : undefined;
      const candidates = await computeMatchRanking({
        requiredSkills: [],
        canonicalRoles,
        topN: Math.max(topN, 8),
      });
      return candidates.slice(0, topN).map((c) => ({
        employeeId: c.employeeId,    // UUID - needed for check_health_impact DB lookup
        employeeCode: c.employeeCode, // business key - for display in plan output
        name: c.name,
        role: c.jobName,
        matchScore: c.matchScore,
        availableFTE: Math.round(c.availableFTE * 100) / 100,
        signal: c.signal,
      }));
    }

    if (name === "check_health_impact") {
      const employeeId = String(args["employeeId"] ?? "");
      const allocs = await db.projectAllocation.findMany({
        where: { employeeId, project: { status: { notIn: ["COMPLETED"] } } },
        select: { projectId: true },
      });
      if (allocs.length === 0) return { safe: true, conflicts: [] };
      const health = await getProjectHealth(allocs.map((a) => a.projectId));
      const conflicts = health.filter((h) =>
        h.ragFlags.some((f) => f.includes("RED")),
      );
      return {
        safe: conflicts.length === 0,
        conflicts: conflicts.map((c) => ({
          projectName: c.projectName,
          flags: c.ragFlags.filter((f) => f.includes("RED")).slice(0, 3),
        })),
      };
    }

    if (name === "record_plan") {
      const raw = args as {
        planName?: string;
        tradeoffSummary?: string;
        hireCount?: number;
        redeployCount?: number;
        residualShortfall?: number;
        riskFlags?: string[];
        assignments?: {
          role: string;
          type: string;
          employeeId?: string;
          employeeName?: string;
          fitScore?: number;
          riskNote?: string;
        }[];
      };
      const hires = Number(raw.hireCount ?? 0);
      const shortfall = Number(raw.residualShortfall ?? 0);
      const flags = raw.riskFlags ?? [];
      capturedPlans.push({
        planName: raw.planName ?? `Plan ${capturedPlans.length + 1}`,
        tradeoffSummary: raw.tradeoffSummary ?? "",
        hireCount: hires,
        redeployCount: Number(raw.redeployCount ?? 0),
        residualShortfall: shortfall,
        riskFlags: flags,
        assignments: (raw.assignments ?? []).map((a) => ({
          role: a.role,
          type: (a.type?.toUpperCase() === "HIRE" ? "HIRE" : "REDEPLOY") as "REDEPLOY" | "HIRE",
          employeeId: a.employeeId,
          employeeName: a.employeeName,
          fitScore: a.fitScore,
          riskNote: a.riskNote,
        })),
        decisionVariant: derivePlanVariant(hires, shortfall, flags),
      });
      return { recorded: true, planIndex: capturedPlans.length };
    }

    return { error: `Unknown plan-builder tool: ${name}` };
  }

  const roleLines = fallbackForecast.byRole
    .filter((r) => r.shortfall > 0)
    .map(
      (r) =>
        `  ${r.role}: demand ${r.demandFTE.toFixed(1)} FTE, supply ${r.supplyFTE.toFixed(1)}, shortfall ${r.shortfall.toFixed(1)}`,
    )
    .join("\n");

  const userMessage = `Build 2–3 staffing plans for ${input.length} new project(s):
${input.map((i) => `  • ${i.count}× ${i.category}, ${i.weeks}w from ${i.start.toISOString().slice(0, 10)}`).join("\n")}

Pre-computed shortfalls (verify with get_demand):
${roleLines || "  None detected - call get_demand to confirm."}

Follow the MANDATORY SEQUENCE. Call record_plan for each distinct plan. Backtrack if check_health_impact returns conflicts.`;

  try {
    const agentResult = await runAgent({
      system: SYSTEM,
      tools: PLAN_BUILDER_TOOLS,
      dispatch,
      messages: [{ role: "user", text: userMessage }],
      maxRounds: 8,
    });

    return {
      plans: capturedPlans.length > 0 ? capturedPlans : buildFallbackPlans(fallbackForecast),
      narrative: agentResult.finalText,
      trace: agentResult.trace,
      fallbackForecast,
    };
  } catch {
    return {
      plans: buildFallbackPlans(fallbackForecast),
      narrative: "AI planning unavailable - showing deterministic forecast.",
      trace: [],
      fallbackForecast,
    };
  }
}
