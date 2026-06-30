import { Suspense } from "react";
import { getPipelineRequestsWithContext, getBenchEmployees } from "@/server/actions/pipeline";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineClient } from "./pipeline-client";

async function PipelineData() {
  const [requests, bench] = await Promise.all([
    getPipelineRequestsWithContext(false),
    getBenchEmployees().catch(() => [])
  ]);
  return <PipelineClient requests={requests} benchCount={bench.length} />;
}

export default function PipelinePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Suspense fallback={<Skeleton className="h-[700px] w-full rounded-lg" />}>
        <PipelineData />
      </Suspense>
    </div>
  );
}


