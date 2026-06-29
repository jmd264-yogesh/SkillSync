import { Suspense } from "react";
import { getPipelineRequestsWithContext } from "@/server/actions/pipeline";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineInceptionClient } from "./pipeline-client";

async function PipelineData() {
  const requests = await getPipelineRequestsWithContext(false);
  return <PipelineInceptionClient requests={requests} />;
}

export default function PipelineInceptionPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Pipeline Inception"
        description="Stage 1 & 2 opportunity management. Set client context, service lines, and confidence levels before matching resources."
      />
      <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
        <PipelineData />
      </Suspense>
    </div>
  );
}
