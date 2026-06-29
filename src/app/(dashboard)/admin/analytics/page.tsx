import { Suspense } from "react";
import { getPipelineRequestsWithContext, getBenchEmployees } from "@/server/actions/pipeline";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsClient } from "./analytics-client";

async function DashboardData() {
  const [requests, bench] = await Promise.all([
    getPipelineRequestsWithContext(false),
    getBenchEmployees().catch(() => [])
  ]);
  return <AnalyticsClient requests={requests} benchCount={bench.length} />;
}

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics & Reporting"
        description="Interactive resourcing and skill intelligence dashboard"
      />
      <Suspense fallback={<Skeleton className="h-[700px] w-full rounded-lg" />}>
        <DashboardData />
      </Suspense>
    </div>
  );
}


