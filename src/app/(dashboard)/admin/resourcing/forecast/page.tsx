import { Suspense } from "react";
import { getResourceForecastAction, narrateResourceForecastAction } from "@/server/actions/forecast";
import { getExtensionSummaryData } from "@/server/actions/extension-forecast";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ForecastClient } from "./forecast-client";

async function ForecastContent() {
  const params = { horizonMonths: 6, scenario: "weighted" as const };
  const [initial, initialNarrative, extension] = await Promise.all([
    getResourceForecastAction(params),
    narrateResourceForecastAction(params).catch(() => ""),
    getExtensionSummaryData().catch(() => null),
  ]);
  return <ForecastClient initial={initial} initialNarrative={initialNarrative} extension={extension} />;
}

export default function ForecastPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Resource Forecast"
        description="Demand vs supply by role and month, with a revenue projection and a target solver: how many resources to hit a revenue goal."
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <ForecastContent />
      </Suspense>
    </div>
  );
}
