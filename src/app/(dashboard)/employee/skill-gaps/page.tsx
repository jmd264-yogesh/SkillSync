import { getMyGapAnalysis } from "@/server/actions/gap-analysis";
import { GapClient } from "./gap-client";

export default async function SkillGapsPage() {
  const analysis = await getMyGapAnalysis();
  return <GapClient analysis={analysis} />;
}
