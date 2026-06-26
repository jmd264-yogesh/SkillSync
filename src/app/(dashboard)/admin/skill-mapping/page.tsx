import { getCoes } from "@/server/actions/coe";
import { getDesignations } from "@/server/actions/designation";
import { getSkills } from "@/server/actions/skill";
import { PageHeader } from "@/components/shared/page-header";
import { SkillMappingClient } from "./skill-mapping-client";

export default async function SkillMappingPage() {
  const [coes, designations, skills] = await Promise.all([
    getCoes(),
    getDesignations(),
    getSkills(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skill Mapping"
        description="Configure required core competencies and levels for each COE and professional designation."
      />
      <SkillMappingClient
        coes={coes.map((c) => ({ id: c.id, name: c.name, description: c.description }))}
        designations={designations.map((d) => ({ id: d.id, name: d.name, level: d.level }))}
        skills={skills.map((s) => ({ id: s.id, name: s.name, category: s.category }))}
      />
    </div>
  );
}
