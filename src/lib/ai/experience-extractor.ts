import { z } from "zod";
import { genAI, MODELS, DEFAULT_TEMPERATURE, AI_TIMEOUT_MS } from "./client";

const extractedDataSchema = z.object({
  skills: z
    .array(
      z.object({
        name: z.string().min(1),
        level: z.number().int().min(1).max(5),
        reasoning: z.string().optional(),
      }),
    )
    .default([]),
  businessDomain: z.string().optional(),
  complexity: z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]).optional(),
  summary: z.string().optional(),
});

export type ExtractedExperience = z.infer<typeof extractedDataSchema>;

const SYSTEM = `You are an expert at extracting professional skills and experience from project documentation.
Extract ONLY skills explicitly mentioned or clearly demonstrated. Do not invent skills not present in the text.
Infer competency levels from context clues: led/architected = 4-5, built/implemented = 3-4, used/worked with = 2-3, exposure = 1-2.
Return valid JSON only - no markdown fences, no explanation outside the JSON.`;

export async function extractExperienceFromText(projectContext: string): Promise<ExtractedExperience> {
  const fallback: ExtractedExperience = { skills: [] };

  try {
    const model = genAI.getGenerativeModel({ model: MODELS.primary, systemInstruction: SYSTEM });

    const prompt = `Extract professional skills from this project description.

<project>
${projectContext}
</project>

Return ONLY this JSON (no markdown):
{
  "skills": [{"name": "skill name", "level": 1-5, "reasoning": "brief reason"}],
  "businessDomain": "e.g. Financial Services",
  "complexity": "LOW|MEDIUM|HIGH|VERY_HIGH",
  "summary": "2-3 sentences on what this person built and demonstrated"
}

Level scale: 1=awareness, 2=beginner, 3=working proficiency, 4=advanced/led, 5=expert/architected.`;

    const result = await Promise.race([
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: DEFAULT_TEMPERATURE, maxOutputTokens: 1024 },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout")), AI_TIMEOUT_MS),
      ),
    ]);

    const text = result.response.text().trim();
    const json = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    return extractedDataSchema.parse(JSON.parse(json) as unknown);
  } catch (err) {
    console.error("[experience-extractor]", err);
    return fallback;
  }
}
