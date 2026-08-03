import { Suspense } from "react";
import { getExtensionForecastData, getExtensionSummaryData } from "@/server/actions/extension-forecast";
import { ExtensionRadarClient } from "./extension-radar-client";

export const metadata = {
  title: "Extension Radar | SkillSphere Resourcing CoLab",
  description: "AI-assisted forecasting of project extension likelihood based on revenue pipeline, client tier and trend signals.",
};

export default async function ExtensionRadarPage() {
  const [rows, summary] = await Promise.all([
    getExtensionForecastData(),
    getExtensionSummaryData(),
  ]);

  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading Extension Radar…</div>}>
      <ExtensionRadarClient rows={rows} summary={summary} />
    </Suspense>
  );
}
