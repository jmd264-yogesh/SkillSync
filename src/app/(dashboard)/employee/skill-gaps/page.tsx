import { getMyGapAnalysis } from "@/server/actions/gap-analysis";
import { generateGapNarrativeAction } from "@/server/actions/ai-features";
import { GapClient } from "./gap-client";

export default async function SkillGapsPage() {
  const [analysis, aiResult] = await Promise.all([
    getMyGapAnalysis(),
    generateGapNarrativeAction().catch(() => ({ narrative: null, configured: false })),
  ]);

  return (
    <GapClient
      analysis={analysis}
      aiNarrative={aiResult.narrative}
      aiConfigured={aiResult.configured}
    />
  );
}
