import { getCoes } from "@/server/actions/coe";
import { getDesignations } from "@/server/actions/designation";
import { getSkills } from "@/server/actions/skill";
import { getCompetencyLevels } from "@/server/actions/competency-level";
import { ConfigClient } from "./config-client";

export default async function ConfigPage() {
  const [coes, designations, skills, levels] = await Promise.all([
    getCoes(),
    getDesignations(),
    getSkills(),
    getCompetencyLevels(),
  ]);

  return (
    <ConfigClient
      coes={coes}
      designations={designations}
      skills={skills}
      levels={levels}
    />
  );
}
