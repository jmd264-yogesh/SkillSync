import { getMyLearningPaths } from "@/server/actions/learning-paths";
import { generateLearningPathSummaryAction } from "@/server/actions/ai-features";
import { LearningPathsClient } from "./learning-paths-client";

export default async function LearningPathsPage() {
  const [paths, aiResult] = await Promise.all([
    getMyLearningPaths(),
    generateLearningPathSummaryAction().catch(() => ({ summary: null, configured: false })),
  ]);

  return (
    <LearningPathsClient
      paths={paths}
      aiSummary={aiResult.summary}
      aiConfigured={aiResult.configured}
    />
  );
}
