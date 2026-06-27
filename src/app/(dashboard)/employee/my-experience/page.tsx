import { getMyExperienceDocs } from "@/server/actions/project-experience";
import { MyExperienceClient } from "./my-experience-client";

export default async function MyExperiencePage() {
  const docs = await getMyExperienceDocs();
  return <MyExperienceClient docs={docs} />;
}
