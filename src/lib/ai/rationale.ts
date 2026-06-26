import { genAI, MODELS, DEFAULT_TEMPERATURE, AI_TIMEOUT_MS } from "./client";
import type { MatchResult } from "@/server/services/matching.service";

const SYSTEM = `You are a resource-planning analyst at a professional-services firm.
Explain why an employee fits a project so a Resource Manager can defend the recommendation.
You are given PRE-COMPUTED scores on TWO distinct dimensions — technical SKILL and consulting COMPETENCY —
plus availability and billability. Never change the numbers.
In 2–4 sentences: name the strongest dimension, the biggest risk, and any unmet skills.
Treat skill and competency as separate — a strong coder with weak stakeholder competency must be described as such.`;

export async function explainMatch(params: {
  projectName: string;
  projectCategory: string;
  candidate: MatchResult;
}): Promise<string> {
  const { projectName, projectCategory, candidate } = params;

  const userContent = `Project: ${projectName} (${projectCategory})
Candidate: ${candidate.name} — ${candidate.jobName ?? "Unknown Role"}
Skill Score: ${candidate.skillScore}/100
Competency Score: ${candidate.competencyScore}/100
Availability: ${Math.round(candidate.availableFTE * 100)}% free
Billability Fit: ${candidate.billabilityFit}/100
Unmet Skills: ${candidate.unmetSkills.length > 0 ? candidate.unmetSkills.join(", ") : "None"}
Signal: ${candidate.signal}

Explain the fit in 2–4 sentences.`;

  try {
    const model = genAI.getGenerativeModel({ model: MODELS.primary, systemInstruction: SYSTEM });
    const response = await Promise.race([
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: { temperature: DEFAULT_TEMPERATURE, maxOutputTokens: 256 },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), AI_TIMEOUT_MS)),
    ]);
    return response.response.text();
  } catch {
    return fallbackRationale(candidate);
  }
}

function fallbackRationale(c: MatchResult): string {
  const dim = c.skillScore >= c.competencyScore ? "technical skills" : "consulting competency";
  const risk = c.unmetSkills.length > 0 ? `missing ${c.unmetSkills[0]}` : "low availability";
  return `${c.name} scores highest on ${dim} with a match score of ${c.matchScore}/100. Primary risk: ${risk}. Signal: ${c.signal}.`;
}
