import { getMySkills, getAvailableSkills, getMyTargetSkills } from "@/server/actions/my-skills";
import { MySkillsClient } from "./my-skills-client";

export default async function MySkillsPage() {
  const [skills, availableSkills, targetSkills] = await Promise.all([
    getMySkills(),
    getAvailableSkills(),
    getMyTargetSkills(),
  ]);

  return (
    <MySkillsClient
      skills={skills}
      availableSkills={availableSkills}
      targetSkills={targetSkills}
    />
  );
}
