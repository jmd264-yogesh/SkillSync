import { Suspense } from "react";
import { getAllocationReport } from "@/server/actions/allocation-report";
import { getUnderUtilizedResources } from "@/server/actions/pipeline";
import { PageHeader } from "@/components/shared/page-header";
import { DecisionCard } from "@/components/shared/decision-card";
import { BenchResourcesPanel } from "@/components/shared/bench-resources-panel";
import { RollingOffStrip } from "./rolling-off-strip";
import { AllocationTableClient } from "./alloc-table-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

async function AllocationTable() {
  const [rows, underUtilized] = await Promise.all([
    getAllocationReport({}),
    getUnderUtilizedResources().catch(() => []),
  ]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        No employees found. Run the ETL to load data.
      </div>
    );
  }

  const over  = rows.filter((r) => r.status === "OVER").length;
  const bench = rows.filter((r) => r.status === "BENCH").length;
  const mismatch = rows.filter((r) => r.mismatch).length;

  // P1 - Workforce decision line
  const overPct = over / rows.length;
  const decisionVariant = overPct > 0.4 ? "NO" : overPct > 0.2 || bench > rows.length * 0.3 ? "YES_WITH_CONDITIONS" : "YES";
  const decisionHeadline = overPct > 0.4
    ? `${over} employees over-allocated - immediate rebalancing required`
    : over > 0
    ? `${over} over-allocated, ${bench} on bench - review recommended`
    : bench > rows.length * 0.3
    ? `${bench} employees on bench - pipeline matching opportunity`
    : "Workforce allocation within healthy range";
  const decisionAction = over > 0
    ? `Reassign ${over} over-allocated employee${over !== 1 ? "s" : ""} or reduce project load to free capacity`
    : bench > 0
    ? `Match ${bench} bench resource${bench !== 1 ? "s" : ""} to active pipeline requests via Match Engine`
    : "No immediate action required - monitor weekly";

  // P3 - Rolling-off strip: employees whose earliest allocation ends in next 14 days
  const now = new Date();
  const cutoff14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const rollingOff = rows.filter(
    (r) => r.releasableFrom && r.releasableFrom >= now && r.releasableFrom <= cutoff14,
  ).sort((a, b) => (a.releasableFrom?.getTime() ?? 0) - (b.releasableFrom?.getTime() ?? 0));

  return (
    <div className="space-y-4">
      {/* Bench & Under-Utilized panel - shown before allocating externally */}
      <BenchResourcesPanel employees={underUtilized} />

      {/* P1 - Decision line */}
      <DecisionCard
        headline={decisionHeadline}
        decisionVariant={decisionVariant}
        action={decisionAction}
        evidence={[
          `${rows.length} employees tracked`,
          `${over} over-allocated (>${Math.round(overPct * 100)}%)`,
          `${bench} on bench`,
          `${mismatch} data-drift (planned ≠ actual)`,
        ]}
      />

      {/* P4 - Rolling-off strip with AI reallocation proposals */}
      <RollingOffStrip
        rollingOff={rollingOff.map((r) => ({
          employeeId: r.employeeId,
          employeeCode: r.employeeCode,
          jobName: r.jobName,
          releasableFrom: r.releasableFrom,
        }))}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total employees", value: rows.length, class: "text-slate-800" },
          { label: "Over-allocated", value: over, class: "text-red-700" },
          { label: "On bench", value: bench, class: "text-slate-600" },
          { label: "Planned ≠ actual", value: mismatch, class: "text-amber-700" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3 px-4">
              <p className={cn("text-2xl font-bold", kpi.class)}>{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table - client component with search + status filter */}
      <AllocationTableClient rows={rows} />
    </div>
  );
}

export default function AllocationsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Live Allocation Board"
        description="Real utilisation from timesheets vs planned allocations. Data drift = planned ≠ actual by >20%."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AllocationTable />
      </Suspense>
    </div>
  );
}
