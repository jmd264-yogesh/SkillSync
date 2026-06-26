import { getSkills } from "@/server/actions/skill";
import { SkillsClient } from "./skills-client";

export default async function SkillsPage() {
  const skills = await getSkills();
  return <SkillsClient skills={skills} />;
}
