import { Suspense } from "react";
import { getAllocationReport } from "@/server/actions/allocation-report";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  OVER:  { label: "Over-allocated", class: "bg-red-50 text-red-700 border-red-200" },
  FULL:  { label: "Fully allocated", class: "bg-amber-50 text-amber-700 border-amber-200" },
  UNDER: { label: "Under-utilised", class: "bg-blue-50 text-blue-700 border-blue-200" },
  BENCH: { label: "Bench",          class: "bg-slate-50 text-slate-600 border-slate-200" },
};

async function AllocationTable() {
  const rows = await getAllocationReport({});

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

  return (
    <div className="space-y-4">
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

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="px-5 py-3 border-b">
          <CardTitle className="text-sm font-semibold">Live Allocation Board</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/60">
                {["Employee", "Role", "COE", "Planned %", "Actual %", "Billable %", "Status", "⚠"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const style = STATUS_STYLES[row.status];
                return (
                  <tr key={row.employeeId} className="border-b last:border-0 hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.jobName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.coe ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={row.plannedUtil > 1 ? "text-red-600 font-semibold" : "text-slate-700"}>
                        {Math.round(row.plannedUtil * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={row.actualUtil > 1 ? "text-red-600 font-semibold" : "text-slate-700"}>
                        {Math.round(row.actualUtil * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{Math.round(row.billableUtil * 100)}%</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={cn("text-xs", style.class)}>{style.label}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {row.mismatch && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          Data drift
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
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
