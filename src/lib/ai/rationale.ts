import { genAI, MODELS, DEFAULT_TEMPERATURE, AI_TIMEOUT_MS } from "./client";
import type { MatchResult } from "@/server/services/matching.service";

const SYSTEM = `You are a resource-planning analyst at a professional-services firm.
Explain why an employee fits (or doesn't fit) a pipeline project so a Resource Manager can defend the recommendation.
You are given PRE-COMPUTED scores on distinct dimensions - skill, competency, experience depth, availability, and COE alignment.
Never change the numbers. In 2–4 sentences: name the strongest dimension, call out the biggest risk, mention COE/experience
alignment if relevant, and note any risk flags (GHOST, SHADOW, LEAVER, OVER_ALLOCATED, UNDER_LEVELLED).
Treat skill and competency as separate - a strong coder with weak stakeholder competency must be described as such.`;

export interface ExplainMatchParams {
  projectName: string;
  projectCategory: string;
  candidate: MatchResult;
  // Extended context from v2 scoring (all optional for backward compat)
  experienceScore?: number;
  coeAligned?: boolean;
  coeName?: string | null;
  designationGap?: number;   // positive = over-levelled, negative = under-levelled
  riskFlags?: string[];
}

export async function explainMatch(params: ExplainMatchParams): Promise<string> {
  const {
    projectName,
    projectCategory,
    candidate,
    experienceScore,
    coeAligned,
    coeName,
    designationGap,
    riskFlags,
  } = params;

  const coeStr =
    coeAligned !== undefined
      ? `\nCOE Alignment: ${coeAligned ? `Yes - ${coeName ?? "matched"}` : "No"}`
      : "";

  const expStr =
    experienceScore !== undefined
      ? `\nExperience Depth Score: ${experienceScore}/100`
      : "";

  const desigStr =
    designationGap !== undefined && designationGap !== 0
      ? `\nDesignation Gap: ${
          designationGap > 0
            ? `+${designationGap} levels (over-levelled - senior resource on junior request)`
            : `${designationGap} levels (under-levelled - candidate is more junior than requested)`
        }`
      : "";

  const riskStr =
    riskFlags && riskFlags.length > 0
      ? `\nRisk Flags: ${riskFlags.join(", ")}`
      : "\nRisk Flags: None";

  const userContent = `Project: ${projectName} (${projectCategory})
Candidate: ${candidate.name} - ${candidate.jobName ?? "Unknown Role"}
Match Score: ${candidate.matchScore}/100
Skill Score: ${candidate.skillScore}/100
Competency Score: ${candidate.competencyScore}/100${expStr}
Availability: ${Math.round(candidate.availableFTE * 100)}% free
Billability Fit: ${candidate.billabilityFit}/100
Unmet Skills: ${candidate.unmetSkills.length > 0 ? candidate.unmetSkills.join(", ") : "None"}${coeStr}${desigStr}${riskStr}
Signal: ${candidate.signal}

Explain the fit in 2–4 sentences.`;

  try {
    const model = genAI.getGenerativeModel({
      model: MODELS.primary,
      systemInstruction: SYSTEM,
    });
    const response = await Promise.race([
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: { temperature: DEFAULT_TEMPERATURE, maxOutputTokens: 300 },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), AI_TIMEOUT_MS),
      ),
    ]);
    return response.response.text();
  } catch {
    return fallbackRationale(
      candidate,
      experienceScore,
      coeAligned,
      coeName,
      riskFlags,
    );
  }
}

function fallbackRationale(
  c: MatchResult,
  experienceScore?: number,
  coeAligned?: boolean,
  coeName?: string | null,
  riskFlags?: string[],
): string {
  const dim = c.skillScore >= c.competencyScore ? "technical skills" : "consulting competency";
  const risk =
    c.unmetSkills.length > 0 ? `missing ${c.unmetSkills[0]}` : "low availability";
  const coeNote =
    coeAligned === true ? ` COE-aligned (${coeName ?? "matched"}).` : "";
  const expNote =
    experienceScore !== undefined && experienceScore > 0
      ? ` Experience depth: ${experienceScore}/100.`
      : "";
  const riskNote =
    riskFlags && riskFlags.length > 0
      ? ` Risk flags: ${riskFlags.join(", ")}.`
      : "";
  return `${c.name} scores ${c.matchScore}/100, strongest on ${dim}.${coeNote}${expNote} Primary risk: ${risk}. Signal: ${c.signal}.${riskNote}`;
}
