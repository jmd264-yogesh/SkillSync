"use server";

import { auth } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { genAI, MODELS } from "@/lib/ai/client";
import { PROPOSITION_ROLES } from "@/lib/constants";
import { lookupBaseline, HISTORICAL_REFERENCE_TABLE } from "@/lib/historical-allocations";
import { computeMatchRanking } from "@/server/services/matching.service";
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
with delivery split between UK (client-facing) and Chennai (technical delivery hub).

═══ UK vs CHENNAI PHILOSOPHY (CRITICAL — never violate this) ═══
UK roles (${UK_ROLES.join(", ")}):
  - Purpose: client relationship management, advisory, consulting oversight, sign-off.
  - Headcount driver: CLIENT RELATIONSHIP COMPLEXITY — number of stakeholders, seniority of engagement.
  - DO NOT increase UK roles because of source systems, data volume, or technical complexity.
  - A project with 25 source systems needs the SAME UK consulting layer as one with 3 sources.

Chennai roles (${CHENNAI_ROLES.join(", ")}):
  - Purpose: all technical delivery — ETL/connectors, data engineering, platform build, QA, junior analytics.
  - Headcount driver: TECHNICAL COMPLEXITY — number of source systems, data volume, build complexity.
  - Every additional source system adds engineering effort → more SW, SSE, TA, SE needed.

═══ SOURCE SYSTEM SCALING (additive on top of historical baseline) ═══
Each source system requires connector development, data modelling, testing, and maintenance.
When the number of source systems is known, add these headcounts to the historical baseline:

  1–5 sources:   baseline only (no additional)
  6–10 sources:  +1 SW, +0.5 SSE
  11–15 sources: +2 SW, +1 SSE, +0.25 TA
  16–20 sources: +3 SW, +1.5 SSE, +0.5 TA, +0.5 SE
  21–30 sources: +4 SW, +2 SSE, +1 TA, +1 SE
  30+ sources:   +5 SW, +3 SSE, +1.5 TA, +1.5 SE

Roles added: Software Engineer (SW), Senior Software Engineer (SSE),
Technical Solutions Architect (TA), Solutions Enabler (SE) — Chennai only.
UK roles stay at baseline regardless of source count.

═══ HISTORICAL REFERENCE ═══
${HISTORICAL_REFERENCE_TABLE}

═══ INSTRUCTIONS ═══
1. Start from the historical baseline for the given solution/phase/criticality.
2. Apply source system scaling if sources are mentioned in context.
3. Apply any other context adjustments (client complexity → UK roles; data complexity → Chennai).
4. Return HEADCOUNT values: 1.0 = one person full-time, 0.5 = half-time, 2.0 = two people.
5. Roles with no involvement = 0.
6. In the narrative: state baseline used, source count detected (if any), and exact adjustments made.

You MUST return allocations for EXACTLY these roles (in this order):
${PROPOSITION_ROLES.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Respond with ONLY a JSON object — no markdown, no explanation outside JSON:
{
  "allocations": [
    { "role": "<exact role name from list>", "allocation": <headcount number, e.g. 0.5 or 2> },
    ... (all 19 roles must appear)
  ],
  "narrative": "<2-3 sentences: baseline used + source count detected + exact headcount adjustments>",
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

// ── Resource matching ─────────────────────────────────────────────────────────

export interface RoleCandidate {
  employeeId: string;
  employeeCode: string;
  name: string;
  jobName: string | null;
  designationName: string | null;
  coeName: string | null;
  matchScore: number;
  availableFTE: number;
  signal: string;
  riskFlags: string[];
  recommendation: string;
}

export interface RoleResourceMatch {
  role: string;
  fte: number;
  candidates: RoleCandidate[];
}

function deriveRecommendation(matchScore: number, availableFTE: number, signal: string, riskFlags: string[]): string {
  if (riskFlags.includes("LEAVER")) return "Leaving soon — confirm notice period before committing";
  if (riskFlags.includes("OVER_ALLOCATED")) return "Over-allocated — resolve before assigning";
  if (signal === "HIRE") return "No internal match — consider external hire";
  if (signal === "PARTIAL_HIRE") return matchScore >= 55 ? "Partial fit — skill gap; plan upskilling" : "Weak fit — prefer other candidates";
  if (availableFTE >= 0.8 && matchScore >= 75) return "Strong match — available now, ready to deploy";
  if (availableFTE >= 0.5 && matchScore >= 65) return "Good fit — sufficient availability";
  if (availableFTE < 0.3) return "Limited availability — confirm capacity before committing";
  return "Suitable — review allocation before confirming";
}

export async function findResourcesForSimulation(
  allocations: { role: string; fte: number }[],
): Promise<RoleResourceMatch[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const activeRoles = allocations.filter((a) => a.fte > 0);

  const results = await Promise.all(
    activeRoles.map(async (alloc) => {
      const candidates = await computeMatchRanking({
        requiredSkills: [],
        canonicalRoles: [alloc.role],
        topN: 5,
        internalFirst: true,
      });

      return {
        role: alloc.role,
        fte: alloc.fte,
        candidates: candidates.map((c) => ({
          employeeId: c.employeeId,
          employeeCode: c.employeeCode,
          name: c.name,
          jobName: c.jobName,
          designationName: c.designationName,
          coeName: c.coeName,
          matchScore: c.matchScore,
          availableFTE: Math.round(c.availableFTE * 100),
          signal: c.signal,
          riskFlags: c.riskFlags as string[],
          recommendation: deriveRecommendation(c.matchScore, c.availableFTE, c.signal, c.riskFlags as string[]),
        })),
      };
    }),
  );

  return results;
}
