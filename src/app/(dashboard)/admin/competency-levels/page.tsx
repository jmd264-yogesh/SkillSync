import { getCompetencyLevels } from "@/server/actions/competency-level";
import { CompetencyLevelsClient } from "./competency-levels-client";

export default async function CompetencyLevelsPage() {
  const levels = await getCompetencyLevels();
  return <CompetencyLevelsClient levels={levels} />;
}
