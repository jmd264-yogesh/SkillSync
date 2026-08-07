import { genAI, MODELS, DEFAULT_TEMPERATURE, AI_TIMEOUT_MS } from "./client";
import type { ProjectHealthResult } from "@/server/services/health.service";

const SYSTEM = `You are a delivery-assurance analyst.
Given weekly RAG trends (scope/schedule/quality/csat/team) plus timesheet-derived billability leakage
and shadow-resource counts, explain the likely ROOT CAUSE and ONE intervention for this week.
Synthesize across signals - do not list them separately.
3 sentences: (1) what's happening, (2) most likely why, (3) the intervention.
Use only the provided data. Never invent numbers.`;

export async function explainHealth(params: {
  projectName: string;
  health: ProjectHealthResult;
}): Promise<string> {
  const { projectName, health } = params;
  const latest = health.ragTrend[health.ragTrend.length - 1];

  const userContent = `Project: ${projectName}
Latest RAG: Schedule=${latest?.schedule ?? "UNKNOWN"} Quality=${latest?.quality ?? "UNKNOWN"} CSAT=${latest?.csat ?? "UNKNOWN"} Team=${latest?.team ?? "UNKNOWN"}
Unbillable Leakage: ${health.leakageHours.toFixed(0)}h (${Math.round(health.unbillablePct * 100)}% of hours)
Shadow Resources: ${health.shadowCount}
Ghost Allocations: ${health.ghostCount}
Releasable FTE: ${health.releasableFTE.toFixed(1)}
Contributing Factors: ${health.contributingFactors.join("; ") || "None identified"}

Explain root cause and one intervention in 3 sentences.`;

  try {
    const model = genAI.getGenerativeModel({ model: MODELS.primary, systemInstruction: SYSTEM });
    const response = await Promise.race([
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: { temperature: DEFAULT_TEMPERATURE, maxOutputTokens: 256 },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), AI_TIMEOUT_MS)),
    ]);
    return response.response.text().replace(/[—–]/g, "-");
  } catch {
    return fallbackRootCause(health);
  }
}

function fallbackRootCause(h: ProjectHealthResult): string {
  const topFactor = h.contributingFactors[0] ?? "multiple contributing signals";
  return `This project shows ${h.ragFlags.join(", ") || "elevated risk signals"}. Root cause appears to be ${topFactor}. Recommended intervention: review resourcing allocation and escalate with the delivery manager.`;
}
