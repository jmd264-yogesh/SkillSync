import { getCoes } from "@/server/actions/coe";
import { getDesignations } from "@/server/actions/designation";
import { getSkills } from "@/server/actions/skill";
import { getCompetencyLevels } from "@/server/actions/competency-level";
import { getClusters } from "@/server/actions/cluster";
import { ConfigClient } from "./config-client";

export default async function ConfigPage() {
  const [coes, designations, skills, levels, clusters] = await Promise.all([
    getCoes(),
    getDesignations(),
    getSkills(),
    getCompetencyLevels(),
    getClusters(),
  ]);

  return (
    <ConfigClient
      coes={coes}
      designations={designations}
      skills={skills}
      levels={levels}
      clusters={clusters}
    />
  );
}

