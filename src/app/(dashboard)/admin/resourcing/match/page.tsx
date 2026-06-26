import { Suspense } from "react";
import { getPipelineRequests } from "@/server/actions/recommendation";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchClient } from "./match-client";

async function MatchPageContent() {
  const pipelineRequests = await getPipelineRequests();
  return <MatchClient pipelineRequests={pipelineRequests} />;
}

export default function MatchPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Resource Match Engine"
        description="Two-dimension matching: technical skill score × consulting competency score. Every result ends in a Redeploy or Hire signal."
      />
      <Suspense fallback={<div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}>
        <MatchPageContent />
      </Suspense>
    </div>
  );
}
