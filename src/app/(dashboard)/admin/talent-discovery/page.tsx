import { getTalentFilterOptions, getSkillDemandProfile } from "@/server/actions/talent-discovery";
import { TalentClient } from "./talent-client";

export default async function TalentDiscoveryPage() {
  const [options, demandProfile] = await Promise.all([
    getTalentFilterOptions(),
    getSkillDemandProfile(),
  ]);
  return <TalentClient options={options} demandProfile={demandProfile} />;
}
