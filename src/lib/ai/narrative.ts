import { genAI, MODELS, DEFAULT_TEMPERATURE, AI_TIMEOUT_MS } from "./client";
import type { PipelineOutlook } from "@/server/services/forecast.service";

const SYSTEM = `You are a workforce-planning strategist.
Given a 6-month demand-vs-supply matrix (SOW-weighted; confirmed vs probable separated; attrition included),
write a brief executive early-warning:
- first shortfall month
- roles/skills at risk
- whether driven by confirmed or probable demand
- 2–3 proactive actions (hire lead time, redeploy from ramp-downs, defer unsigned work)
4–6 sentences. State confidence level if data coverage is low. Never alter provided numbers.`;

export async function forecastNarrative(outlook: PipelineOutlook): Promise<string> {
  const shortfallItems = outlook.monthlyGaps.filter((g) => g.gap < 0);
  const userContent = `Forecast horizon: ${outlook.monthlyGaps.length > 0 ? "6 months" : "no data"}
Confirmed pipeline items: ${outlook.confirmedCount}
Probable pipeline items: ${outlook.probableCount}
Attrition count: ${outlook.attritionCount}
Data coverage: ${outlook.dataCoverage}%
First shortfall month: ${outlook.firstShortfallMonth ?? "None identified"}
Shortfall items: ${shortfallItems.map((g) => `${g.month} ${g.role}: ${Math.abs(g.gap).toFixed(1)} FTE shortfall`).join("; ") || "None"}

Write a 4–6 sentence early-warning narrative.`;

  try {
    const model = genAI.getGenerativeModel({ model: MODELS.primary, systemInstruction: SYSTEM });
    const response = await Promise.race([
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: { temperature: DEFAULT_TEMPERATURE, maxOutputTokens: 384 },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), AI_TIMEOUT_MS)),
    ]);
    return response.response.text();
  } catch {
    return fallbackNarrative(outlook);
  }
}

function fallbackNarrative(o: PipelineOutlook): string {
  if (!o.firstShortfallMonth) {
    return `Current 6-month pipeline shows no projected shortfall. ${o.confirmedCount} confirmed and ${o.probableCount} probable requests are within supply capacity. Monitor closely as new requests are added.`;
  }
  return `First projected shortfall: ${o.firstShortfallMonth}. ${o.attritionCount} departures will reduce supply. Recommend reviewing ramp-down resources for redeployment and initiating hiring for critical roles now.`;
}
