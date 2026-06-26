import { getReviewCycles } from "@/server/actions/review-cycle";
import { PageHeader } from "@/components/shared/page-header";
import { CyclesClient } from "./cycles-client";

export default async function FeedbackCyclesPage() {
  const cycles = await getReviewCycles();
  return (
    <div>
      <PageHeader
        title="Feedback & Promotion"
        description="Manage review cycles, feedback forms, and track promotion readiness across your organization."
      />
      <CyclesClient cycles={cycles} />
    </div>
  );
}
