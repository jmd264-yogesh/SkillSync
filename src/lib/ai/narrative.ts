import { genAI, MODELS, DEFAULT_TEMPERATURE, AI_TIMEOUT_MS } from "./client";
import type { PipelineOutlook, ResourceForecast } from "@/server/services/forecast.service";

const SYSTEM = `You are a workforce-planning strategist.
Given a 6-month demand-vs-supply matrix (SOW-weighted; confirmed vs probable separated; attrition included),
write a brief executive early-warning:
- first shortfall month
- roles/skills at risk
- whether driven by confirmed or probable demand
- 2 to 3 proactive actions (hire lead time, redeploy from ramp-downs, defer unsigned work)
4 to 6 sentences. State confidence level if data coverage is low. Never alter provided numbers.
Do not use em-dashes or en-dashes. Use commas, colons, or separate sentences instead.`;

export async function forecastNarrative(outlook: PipelineOutlook): Promise<string> {
  const shortfallItems = outlook.monthlyGaps.filter((g) => g.gap < 0);
  const userContent = `Forecast horizon: ${outlook.monthlyGaps.length > 0 ? "6 months" : "no data"}
Confirmed pipeline items: ${outlook.confirmedCount}
Probable pipeline items: ${outlook.probableCount}
Attrition count: ${outlook.attritionCount}
Data coverage: ${outlook.dataCoverage}%
First shortfall month: ${outlook.firstShortfallMonth ?? "None identified"}
Shortfall items: ${shortfallItems.map((g) => `${g.month} ${g.role}: ${Math.abs(g.gap).toFixed(1)} FTE shortfall`).join("; ") || "None"}

Write a 4 to 6 sentence early-warning narrative.`;

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

// ─── Resource Forecast narrative (revenue-aware) ─────────────

const FORECAST_SYSTEM = `You are a workforce-planning strategist advising a professional-services resource manager.
Given a revenue-aware resource forecast (demand vs supply by role, projected revenue, margin, revenue-at-risk, bench, attrition),
write a crisp executive read in 3 to 4 sentences:
- lead with the headline: are we covered, or where does the first gap open (role + month)?
- name the money impact (projected revenue and/or revenue at risk) in plain terms
- give ONE clear action (hire by date, redeploy bench, or defer unsigned work)
Use the exact figures provided. Never invent or alter numbers. No jargon. British English, currency in GBP.
Do not use em-dashes or en-dashes. Use commas, colons, or separate sentences instead.`;

function money(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${Math.round(n)}`;
}

export async function resourceForecastNarrative(
  f: ResourceForecast,
  scenarioLabel?: string,
): Promise<string> {
  const topGaps = f.byRole
    .filter((r) => r.shortfallFTE > 0)
    .slice(0, 4)
    .map((r) => `${r.role}: short ${r.shortfallFTE} FTE${r.hireByDate ? ` (hire by ${r.hireByDate})` : ""}`)
    .join("; ");

  const userContent = `Scenario: ${scenarioLabel ?? f.scenario}
Horizon: ${f.horizonMonths} months
Total shortfall: ${f.totalShortfallFTE} FTE across ${f.totalHireCount} hire(s)
First shortfall month: ${f.firstShortfallMonth ?? "none"}${f.hireByDate ? ` (hire-by ${f.hireByDate})` : ""}
Projected revenue (annual): ${money(f.projectedAnnualRevenue)} at ${f.projectedMarginPct}% margin
Revenue at risk (annual): ${money(f.revenueAtRiskAnnual)}
Bench available: ${f.benchFTE} FTE · Attrition in horizon: ${f.attritionCount}
Role gaps: ${topGaps || "none"}
Data coverage: ${f.dataCoverage}%

Write the 3 to 4 sentence executive read.`;

  try {
    const model = genAI.getGenerativeModel({ model: MODELS.primary, systemInstruction: FORECAST_SYSTEM });
    const response = await Promise.race([
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: { temperature: DEFAULT_TEMPERATURE, maxOutputTokens: 320 },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), AI_TIMEOUT_MS)),
    ]);
    return response.response.text();
  } catch {
    return fallbackForecastNarrative(f);
  }
}

function fallbackForecastNarrative(f: ResourceForecast): string {
  if (f.totalShortfallFTE <= 0) {
    return `Supply covers projected demand across the ${f.horizonMonths}-month horizon, with ${money(f.projectedAnnualRevenue)} projected annual revenue at ${f.projectedMarginPct}% margin. ${f.benchFTE > 0 ? `You have ${f.benchFTE} FTE on bench, deploy it against incoming pipeline to avoid cost leakage.` : "Capacity is well matched to demand."} Monitor as new SOW-signed deals arrive.`;
  }
  const lead = f.firstShortfallMonth
    ? `A ${f.totalShortfallFTE} FTE gap opens around ${f.firstShortfallMonth}, requiring roughly ${f.totalHireCount} hire(s).`
    : `Capacity is tight, with a ${f.totalShortfallFTE} FTE gap across the horizon.`;
  return `${lead} ${money(f.revenueAtRiskAnnual)} of annual revenue is at risk from demand you can't currently staff. ${f.hireByDate ? `Start hiring by ${f.hireByDate} (8-week lead time)` : "Rebalance from bench or ramp-down projects"}${f.benchFTE > 0 ? `, and redeploy the ${f.benchFTE} FTE on bench first.` : "."}`;
}
