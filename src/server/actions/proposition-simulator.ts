"use server";

import { auth } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { genAI, MODELS } from "@/lib/ai/client";
import { PROPOSITION_ROLES } from "@/lib/constants";
import type { PropositionRole } from "@/lib/constants";

export interface RoleAllocation {
  role: PropositionRole;
  percentage: number;
}

export interface PropositionSimulatorResult {
  allocations: RoleAllocation[];
  narrative: string;
  totalFTE: number;
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

Given a proposition (service line), project type, and duration, return what percentage of total
project effort each role contributes. Use location context:
- Due Diligence / Data Advisory: UK-heavy (Partner, Principal, Manager lead; minimal Chennai)
- Core Reporting / Managed Service: balanced to Chennai-heavy (delivery roles do the work)
- Value Creation: strong UK consulting layer + Chennai analytics/tech delivery
- Exit Support: UK-led advisory + some Chennai data platform support

You MUST return allocations for EXACTLY these roles (in this order):
${PROPOSITION_ROLES.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Rules:
- Percentages must sum to exactly 100.
- Roles with no involvement get 0.
- Tailor the UK vs Chennai split to the proposition and project type.
- Technology roles (Principal Technology Architect, Senior Software Engineer, etc.) are prominent
  in build-heavy projects; consulting roles dominate advisory projects.

Respond with ONLY a JSON object — no markdown, no explanation outside JSON:
{
  "allocations": [
    { "role": "<exact role name from list>", "percentage": <number 0-100> },
    ... (all 19 roles must appear)
  ],
  "narrative": "<2-3 sentences explaining the UK vs Chennai split and why this mix fits the proposition>",
  "totalFTE": <number>
}`;

function buildFallback(): PropositionSimulatorResult {
  return {
    allocations: PROPOSITION_ROLES.map((role) => ({ role, percentage: 0 })),
    narrative: "AI recommendation is temporarily unavailable. Run again to retry.",
    totalFTE: 0,
  };
}

function parseAllocations(raw: unknown): RoleAllocation[] {
  if (!Array.isArray(raw)) return PROPOSITION_ROLES.map((role) => ({ role, percentage: 0 }));

  // Build a lookup from AI response (role name → percentage)
  const lookup = new Map<string, number>();
  for (const item of raw as Array<{ role?: unknown; percentage?: unknown }>) {
    if (typeof item.role === "string" && typeof item.percentage === "number") {
      lookup.set(item.role.trim(), item.percentage);
    }
  }

  // Map against canonical role list so order and names are always correct
  const allocations: RoleAllocation[] = PROPOSITION_ROLES.map((role) => ({
    role,
    percentage: lookup.get(role) ?? 0,
  }));

  // Normalise to sum to 100
  const total = allocations.reduce((s, a) => s + a.percentage, 0);
  if (total > 0 && Math.abs(total - 100) > 1) {
    return allocations.map((a) => ({
      ...a,
      percentage: Math.round((a.percentage / total) * 100),
    }));
  }
  return allocations;
}

export async function simulateProposition(input: {
  proposition: string;
  projectType: string;
  projectTypeLabel: string;
  startDate: string;
  weeks: number;
  sourceSystems?: string[];
}): Promise<PropositionSimulatorResult> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const model = genAI.getGenerativeModel({
    model: MODELS.primary,
    systemInstruction: SYSTEM,
  });

  const sourceNote =
    input.sourceSystems && input.sourceSystems.length > 0
      ? `Source systems involved: ${input.sourceSystems.join(", ")}. ` +
        `Each additional source system increases the need for Chennai engineering roles ` +
        `(Senior Software Engineer, Software Engineer, Solutions Enabler, Technical Solutions Architect) ` +
        `to build connectors, ETL pipelines, and data models. Adjust accordingly.`
      : "No specific source systems specified — use a balanced default split.";

  const prompt = `Recommend team allocation percentages for:

Proposition: ${input.proposition}
Project Type: ${input.projectTypeLabel}
Start Date: ${input.startDate}
Duration: ${input.weeks} weeks
${sourceNote}

Assign a % of total project effort to each role. UK roles handle client-facing / senior work;
Chennai roles handle delivery. Roles: ${ROLES_LIST}.
Percentages must sum to 100. Return only the JSON object.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    });

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch?.[0]) return buildFallback();

    const parsed = JSON.parse(jsonMatch[0]) as {
      allocations?: unknown;
      narrative?: unknown;
      totalFTE?: unknown;
    };

    return {
      allocations: parseAllocations(parsed.allocations),
      narrative: typeof parsed.narrative === "string" ? parsed.narrative : "",
      totalFTE: typeof parsed.totalFTE === "number" ? parsed.totalFTE : 0,
    };
  } catch {
    return buildFallback();
  }
}
