import type { Tool } from "@google/generative-ai";
import { SchemaType } from "@google/generative-ai";
import { genAI, MODELS } from "../client";
import { COPILOT_TOOLS } from "./tools";
import { runAgent } from "../agent/runtime";
import { GUARDRAIL_NOTE } from "../agent/guardrails";
import { computeMatchRanking } from "@/server/services/matching.service";
import { normalizeResourceRequest } from "@/lib/role-mapping";
import { getProjectHealth } from "@/server/services/health.service";
import { forecastNewProjects, getPipelineOutlook } from "@/server/services/forecast.service";
import { getEmployeeAvailability, getAvailableFTE } from "@/server/services/availability.service";
import { db } from "@/lib/db";
import type { ProjectCategory } from "@prisma/client";

// Re-export genAI to avoid unused-import warning (used via MODELS in runAgent)
void genAI;

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

function buildSystem(): string {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `You are the RM Copilot for a professional-services resource team (JMAN-style delivery).
Answer staffing and capacity questions grounded ONLY in tool results. Do not invent numbers.

Today's date: ${today}. Use this when reasoning about allocation dates:
- "active" allocation = startDate <= today AND (endDate >= today OR endDate is null)
- "upcoming" allocation = startDate > today (not yet started — person is currently available)
- "completed" allocation = endDate < today (person has rolled off — now available)
- "releasableFrom" = earliest date an employee's current allocations end

Plan your tool calls, execute them, then answer DECISION-FIRST:
1. One-line decision (Yes / No / Yes-with-conditions)
2. Evidence citing exact figures from tool results
3. Recommended action including hire-vs-redeploy trigger
4. Confidence note if data coverage is low

Rules:
- SOW-signed requests are confirmed demand. Unsigned = probable, weighted by deal stage.
- Skill and competency are separate dimensions — name them separately when relevant.
- If a tool is unavailable for something, say so and state what data you'd need.
- Keep it readable by a non-technical RM. No jargon without explanation.
- Format your response in Markdown: use ### for section headings, **bold** for key figures, tables for comparisons, numbered lists for action steps.

${GUARDRAIL_NOTE}`;
}

// ── Token budget: cap tool responses before they re-enter context ────────────
const MAX_ARRAY_ITEMS = 10;
const MAX_HISTORY_TURNS = 4;
const MAX_RESPONSE_CHARS = 3000;

function compactHealthResult(p: Record<string, unknown>) {
  const trend = Array.isArray(p["ragTrend"]) ? p["ragTrend"] : [];
  const latest = trend.length > 0 ? trend[trend.length - 1] : null;
  return {
    projectId: p["projectId"],
    projectName: p["projectName"],
    ragFlags: p["ragFlags"],
    latestRag: latest,
    leakageHours: typeof p["leakageHours"] === "number" ? Math.round(p["leakageHours"]) : 0,
    unbillablePct:
      typeof p["unbillablePct"] === "number"
        ? Math.round((p["unbillablePct"] as number) * 100)
        : 0,
    shadowCount: p["shadowCount"],
    ghostCount: p["ghostCount"],
    releasableFTE:
      typeof p["releasableFTE"] === "number"
        ? Math.round((p["releasableFTE"] as number) * 10) / 10
        : 0,
    isRampDown: p["isRampDown"],
    contributingFactors: Array.isArray(p["contributingFactors"])
      ? (p["contributingFactors"] as string[]).slice(0, 3)
      : [],
  };
}

function compactAllocResult(e: Record<string, unknown>) {
  const releasable = e["releasableFrom"];
  return {
    employeeId: e["employeeId"],
    name: e["name"],
    jobName: e["jobName"],
    status: e["status"],
    actualUtil: typeof e["actualUtil"] === "number" ? Math.round(e["actualUtil"]) : 0,
    billableUtil: typeof e["billableUtil"] === "number" ? Math.round(e["billableUtil"]) : 0,
    activeProjectCount: e["activeProjectCount"],
    // When this employee's current allocations end — null means no active alloc (available now)
    releasableFrom: releasable instanceof Date
      ? releasable.toISOString().split("T")[0]
      : typeof releasable === "string"
      ? releasable.split("T")[0]
      : null,
  };
}

function serializeCopilotOutput(name: string, data: unknown): string {
  let compacted: unknown = data;

  if (name === "get_project_health" && Array.isArray(data)) {
    compacted = (data as Record<string, unknown>[])
      .slice(0, MAX_ARRAY_ITEMS)
      .map(compactHealthResult);
  } else if (name === "get_allocation_report" && Array.isArray(data)) {
    compacted = (data as Record<string, unknown>[])
      .slice(0, MAX_ARRAY_ITEMS)
      .map(compactAllocResult);
  } else if (Array.isArray(data)) {
    compacted = data.slice(0, MAX_ARRAY_ITEMS);
  }

  const serialized = JSON.stringify(compacted);
  return serialized.length > MAX_RESPONSE_CHARS
    ? serialized.slice(0, MAX_RESPONSE_CHARS) + `...[truncated, showing first ${MAX_ARRAY_ITEMS} items]`
    : serialized;
}

async function dispatchCopilot(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  if (name === "recommend_resources") {
    // Role filter: from explicit `role` param or from pipeline request's resourcesRequested
    let canonicalRoles: string[] | undefined;
    if (input["role"]) {
      const parsed = normalizeResourceRequest(String(input["role"]));
      if (parsed.canonicalRoles.length > 0) canonicalRoles = parsed.canonicalRoles;
    }

    if (input["pipelineRequestId"]) {
      const req = await db.pipelineRequest.findUnique({
        where: { id: String(input["pipelineRequestId"]) },
      });
      if (!req) return { error: "Pipeline request not found" };
      // Derive role filter from the pipeline request if not explicitly provided
      if (!canonicalRoles && req.resourcesRequested) {
        const parsed = normalizeResourceRequest(req.resourcesRequested);
        if (parsed.canonicalRoles.length > 0) canonicalRoles = parsed.canonicalRoles;
      }
      const skillsetText = (req.skillset ?? "").toLowerCase();
      let requiredSkills: { skillId: string; skillName: string; requiredLevel: number }[] = [];
      if (skillsetText.length > 0) {
        const allSkills = await db.skill.findMany({ select: { id: true, name: true } });
        requiredSkills = allSkills
          .filter((s) => skillsetText.includes(s.name.toLowerCase()))
          .map((s) => ({ skillId: s.id, skillName: s.name, requiredLevel: 3 }));
      }
      return computeMatchRanking({ requiredSkills, canonicalRoles, topN: 5 });
    }
    const skills =
      (input["requiredSkills"] as {
        skillId: string;
        skillName: string;
        requiredLevel: number;
      }[]) ?? [];
    return computeMatchRanking({ requiredSkills: skills, canonicalRoles, topN: 5 });
  }

  if (name === "forecast_new_projects") {
    const adHoc = input["adHoc"] as
      | { category: string; count: number; start: string; weeks: number }[]
      | undefined;
    const pipelineRequestIds = input["pipelineRequestIds"] as string[] | undefined;
    return forecastNewProjects({
      pipelineRequestIds,
      adHoc: adHoc?.map((a) => ({
        category: a.category as ProjectCategory,
        count: a.count,
        start: new Date(a.start),
        weeks: a.weeks,
      })),
    });
  }

  if (name === "get_pipeline_forecast") {
    return getPipelineOutlook({
      months: (input["months"] as number | undefined) ?? 6,
      cluster: input["cluster"] as number | undefined,
    });
  }

  if (name === "get_project_health") {
    const projectIds = input["projectIds"] as string[] | undefined;
    return getProjectHealth(projectIds);
  }

  if (name === "get_allocation_report") {
    return getEmployeeAvailability();
  }

  if (name === "get_availability") {
    return getAvailableFTE({
      role: input["role"] as string | undefined,
      skillId: input["skillId"] as string | undefined,
      minSkillLevel: input["minSkillLevel"] as number | undefined,
      windowStart: new Date(String(input["windowStart"])),
      windowEnd: new Date(String(input["windowEnd"])),
    });
  }

  if (name === "plan_staffing") {
    // Dynamic import to avoid circular deps at module load time
    const { buildStaffingPlans } = await import("../agent/plan-builder");
    const adHoc = input["adHoc"] as
      | { category: string; count: number; start: string; weeks: number }[]
      | undefined;
    if (!adHoc || adHoc.length === 0) return { error: "adHoc projects required" };
    const result = await buildStaffingPlans(
      adHoc.map((a) => ({
        category: a.category as ProjectCategory,
        count: a.count,
        start: new Date(a.start),
        weeks: a.weeks,
      })),
    );
    // Return compact plan summary for the copilot context
    return {
      planCount: result.plans.length,
      plans: result.plans.map((p) => ({
        planName: p.planName,
        tradeoffSummary: p.tradeoffSummary,
        hireCount: p.hireCount,
        redeployCount: p.redeployCount,
        residualShortfall: p.residualShortfall,
        riskFlags: p.riskFlags.slice(0, 3),
        decisionVariant: p.decisionVariant,
      })),
      narrative: result.narrative.slice(0, 400),
    };
  }

  return { error: `Unknown tool: ${name}` };
}

export async function runCopilotTurn(history: CopilotMessage[]): Promise<string> {
  const priorMessages = history.slice(0, -1);
  const currentMsg = history[history.length - 1];

  if (!currentMsg || currentMsg.role !== "user") {
    return "No user message provided.";
  }

  // Cap history to last N turns to prevent context snowball
  const trimmedPrior = priorMessages.slice(-(MAX_HISTORY_TURNS * 2));

  try {
    const result = await runAgent({
      system: buildSystem(),
      tools: COPILOT_TOOLS as Tool[],
      dispatch: dispatchCopilot,
      messages: [
        ...trimmedPrior.map((m) => ({
          role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
          text: m.content,
        })),
        { role: "user" as const, text: currentMsg.content },
      ],
      maxRounds: 3,
      model: MODELS.fast,
      serializeOutput: serializeCopilotOutput,
    });
    return result.finalText || "I reached the maximum number of tool calls. Please try a more specific question.";
  } catch {
    return "I'm temporarily unavailable. Please try again shortly.";
  }
}
