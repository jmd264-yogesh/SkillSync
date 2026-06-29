"use server";

import { auth } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { genAI, MODELS } from "@/lib/ai/client";
import { PROPOSITION_ROLES } from "@/lib/constants";
import { lookupBaseline, HISTORICAL_REFERENCE_TABLE } from "@/lib/historical-allocations";
import type { PropositionRole } from "@/lib/constants";
import type { HistoricalAllocation } from "@/lib/historical-allocations";

export interface RoleAllocation {
  role: PropositionRole;
  fte: number;
}

export interface BaselineAllocation {
  solution: string;
  phase: string;
  criticality: string;
  resources: { role: string; fte: number }[];
  totalFTE: number;
}

export interface PropositionSimulatorResult {
  allocations: RoleAllocation[];
  narrative: string;
  totalHeadcount: number;
  baseline: BaselineAllocation | null;
}

const ROLES_LIST = PROPOSITION_ROLES.join(", ");

const UK_ROLES = [
  "Partner",
  "Associate Partner",
  "Principal",
  "Manager",
  "Senior Consultant",
  "Consultant",
];

const CHENNAI_ROLES = [
  "Senior Associate Consultant",
  "Associate Consultant",
  "Intern",
  "Partner Technology",
  "Associate Partner Technology",
  "Principal Technology Architect",
  "Technical Solutions Architect",
  "Senior Solutions Consultant",
  "Solutions Consultant",
  "Solutions Enabler",
  "Senior Software Engineer",
  "Software Engineer",
  "Intern Technology",
];

const SYSTEM = `You are a staffing consultant for a professional services data & analytics firm
with delivery split between UK (client-facing) and Chennai (delivery hub).

UK roles are senior, client-facing, and advisory: ${UK_ROLES.join(", ")}.
Chennai roles handle delivery, technology build, and junior consulting: ${CHENNAI_ROLES.join(", ")}.

${HISTORICAL_REFERENCE_TABLE}

CRITICAL INSTRUCTIONS:
1. Return HEADCOUNT values (not percentages summing to 100).
   - 1.0 = one person full-time, 0.5 = one person half-time, 0.12 = ~1 day/fortnight, etc.
   - Your values MUST mirror the historical reference table above as closely as possible.
   - Only adjust when source systems or project context explicitly justifies it.
2. For solution + phase + criticality combinations not in the table, use the nearest match
   and scale proportionally. Keep the same UK/Chennai role mix.
3. Roles with no involvement must be 0.
4. Do NOT drift from the historical patterns without explaining why in the narrative.

You MUST return allocations for EXACTLY these roles (in this order):
${PROPOSITION_ROLES.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Respond with ONLY a JSON object — no markdown, no explanation outside JSON:
{
  "allocations": [
    { "role": "<exact role name from list>", "allocation": <headcount number, e.g. 0.5 or 2> },
    ... (all 19 roles must appear)
  ],
  "narrative": "<2-3 sentences on how this matches company patterns and any adjustments made>",
  "totalHeadcount": <sum of all allocation values>
}`;

function buildFallback(): PropositionSimulatorResult {
  return {
    allocations: PROPOSITION_ROLES.map((role) => ({ role, fte: 0 })),
    narrative: "AI recommendation is temporarily unavailable. Run again to retry.",
    totalHeadcount: 0,
    baseline: null,
  };
}

function parseAllocations(raw: unknown): RoleAllocation[] {
  if (!Array.isArray(raw)) return PROPOSITION_ROLES.map((role) => ({ role, fte: 0 }));

  const lookup = new Map<string, number>();
  for (const item of raw as Array<{ role?: unknown; allocation?: unknown; fte?: unknown }>) {
    const val = item.allocation ?? item.fte;
    if (typeof item.role === "string" && typeof val === "number") {
      lookup.set(item.role.trim(), val);
    }
  }

  return PROPOSITION_ROLES.map((role) => ({
    role,
    fte: Math.round((lookup.get(role) ?? 0) * 100) / 100,
  }));
}

function buildBaselineResult(
  match: HistoricalAllocation,
): BaselineAllocation {
  const totalFTE = match.resources.reduce((s, r) => s + r.fte, 0);
  return {
    solution: match.solution,
    phase: match.phase,
    criticality: match.criticality,
    resources: match.resources,
    totalFTE: Math.round(totalFTE * 100) / 100,
  };
}

export async function simulateProposition(input: {
  proposition: string;
  projectType: string;
  projectTypeLabel: string;
  startDate: string;
  weeks: number;
  phase?: string;
  criticality?: string;
  sourceSystems?: string[];
  description?: string;
}): Promise<PropositionSimulatorResult> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  // Baseline: deterministic lookup from historical table
  const baselineMatch =
    input.phase && input.criticality
      ? lookupBaseline(input.projectType, input.phase, input.criticality)
      : null;
  const baseline = baselineMatch ? buildBaselineResult(baselineMatch) : null;

  const model = genAI.getGenerativeModel({
    model: MODELS.primary,
    systemInstruction: SYSTEM,
  });

  const phaseNote = input.phase
    ? `Engagement Phase: ${input.phase}`
    : "Engagement Phase: not specified";

  const criticalityNote = input.criticality
    ? `Project Criticality: ${input.criticality} — ${
        input.criticality === "Stable"
          ? "lean footprint, minimal headcount"
          : input.criticality === "Medium"
          ? "standard staffing"
          : "expanded delivery and tech headcount"
      }`
    : "Project Criticality: not specified";

  const baselineNote = baseline
    ? `Historical baseline found for ${baseline.solution} / ${baseline.phase} / ${baseline.criticality}:
${baseline.resources.map((r) => `  ${r.fte} FTE ${r.role}`).join("\n")}
  Total: ${baseline.totalFTE} FTE
Use these FTE ratios as your primary anchor when computing percentage allocations.`
    : "No exact historical baseline found — use the nearest pattern from the reference table.";

  const sourceNote =
    input.sourceSystems && input.sourceSystems.length > 0
      ? `Source systems: ${input.sourceSystems.join(", ")}. ` +
        `Each additional source system increases the need for Chennai engineering roles ` +
        `(Senior Software Engineer, Software Engineer, Solutions Enabler, Technical Solutions Architect).`
      : "";

  const descriptionNote =
    input.description && input.description.trim().length > 0
      ? `\nAdditional project context:\n<context>\n${input.description.trim()}\n</context>\nUse this context to refine the allocation. Reflect any adjustments in the narrative.`
      : "";

  const prompt = `Recommend headcount allocations for:

Proposition: ${input.proposition}
Project Type: ${input.projectTypeLabel}
${phaseNote}
${criticalityNote}
Start Date: ${input.startDate}
Duration: ${input.weeks} weeks

${baselineNote}
${sourceNote}${descriptionNote}

Return headcount values per role (1.0 = one person full-time, 0.5 = half-time, etc.)
matching the historical reference table as closely as possible.
Roles: ${ROLES_LIST}.
Return only the JSON object.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 1024 },
    });

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch?.[0]) return { ...buildFallback(), baseline };

    const parsed = JSON.parse(jsonMatch[0]) as {
      allocations?: unknown;
      narrative?: unknown;
      totalHeadcount?: unknown;
      totalFTE?: unknown;
    };

    const allocations = parseAllocations(parsed.allocations);
    const totalHeadcount =
      typeof parsed.totalHeadcount === "number"
        ? parsed.totalHeadcount
        : typeof parsed.totalFTE === "number"
        ? parsed.totalFTE
        : Math.round(allocations.reduce((s, a) => s + a.fte, 0) * 100) / 100;

    return {
      allocations,
      narrative: typeof parsed.narrative === "string" ? parsed.narrative : "",
      totalHeadcount,
      baseline,
    };
  } catch {
    return { ...buildFallback(), baseline };
  }
}
