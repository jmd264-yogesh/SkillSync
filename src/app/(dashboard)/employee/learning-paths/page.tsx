import { getMyLearningPaths } from "@/server/actions/learning-paths";
import { LearningPathsClient } from "./learning-paths-client";

export default async function LearningPathsPage() {
  const paths = await getMyLearningPaths();
  return <LearningPathsClient paths={paths} />;
}
