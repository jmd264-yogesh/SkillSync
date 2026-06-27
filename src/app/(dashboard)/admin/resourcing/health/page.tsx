import { Suspense } from "react";
import { getHealthRadar } from "@/server/actions/project-health";
import { PageHeader } from "@/components/shared/page-header";
import { DecisionCard } from "@/components/shared/decision-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const RAG_STYLES = {
  GREEN:   "bg-green-100 text-green-700",
  AMBER:   "bg-amber-100 text-amber-700",
  RED:     "bg-red-100 text-red-700",
  UNKNOWN: "bg-slate-100 text-slate-500",
};

async function HealthRadarContent() {
  const projects = await getHealthRadar();

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No active projects"
        description="Run the ETL to load project and weekly status data."
      />
    );
  }

  const withFlags = projects.filter((p) => p.ragFlags.length > 0).length;
  const totalLeakage = projects.reduce((s, p) => s + p.leakageHours, 0);
  const totalShadow = projects.reduce((s, p) => s + p.shadowCount, 0);
  // P5 — Portfolio-level releasable FTE
  const totalReleasable = projects.reduce((s, p) => s + p.releasableFTE, 0);
  const rampDownProjects = projects.filter((p) => p.isRampDown);

  return (
    <div className="space-y-5">
      {/* Summary strip — 4-column including releasable FTE */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-lg border px-4 py-3">
          <p className="text-xl font-bold text-red-700">{withFlags}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Projects with risk flags</p>
        </div>
        <div className="bg-slate-50 rounded-lg border px-4 py-3">
          <p className="text-xl font-bold text-amber-700">{totalLeakage.toFixed(0)}h</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total unbillable leakage</p>
        </div>
        <div className="bg-slate-50 rounded-lg border px-4 py-3">
          <p className="text-xl font-bold text-slate-700">{totalShadow}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Shadow resources detected</p>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-100 px-4 py-3">
          <p className="text-xl font-bold text-blue-700">{totalReleasable.toFixed(1)} FTE</p>
          <p className="text-xs text-muted-foreground mt-0.5">Releasable from ramp-downs</p>
        </div>
      </div>

      {/* P5 — Ramp-down candidates */}
      {rampDownProjects.length > 0 && (
        <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-5 py-4">
          <p className="text-sm font-semibold text-blue-800 mb-2">
            {rampDownProjects.length} project{rampDownProjects.length !== 1 ? "s" : ""} winding down — {totalReleasable.toFixed(1)} FTE available for redeployment
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {rampDownProjects.map((p) => (
              <div key={p.projectId} className="flex items-center justify-between bg-white rounded border border-blue-100 px-3 py-2 text-xs">
                <span className="text-slate-700 font-medium truncate mr-3">{p.projectName}</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                  {p.releasableFTE.toFixed(1)} FTE
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Use the Match Engine to assign these resources to upcoming pipeline requests.
          </p>
        </div>
      )}

      {/* Project cards */}
      <div className="space-y-4">
        {projects.map((p) => {
          const latest = p.ragTrend[p.ragTrend.length - 1];
          const hasRisk = p.ragFlags.length > 0;
          const variant = p.ragFlags.includes("SCHEDULE_RED") || p.leakageHours > 80
            ? "NO"
            : hasRisk ? "YES_WITH_CONDITIONS" : "YES";

          return (
            <DecisionCard
              key={p.projectId}
              headline={p.projectName}
              decisionVariant={variant}
              action={
                p.isRampDown
                  ? `Ramp-down: ${p.releasableFTE.toFixed(1)} FTE releasable — plan redeployment now`
                  : p.shadowCount > 0
                  ? `Formalise ${p.shadowCount} shadow resource(s) or remove unbillable hours`
                  : p.leakageHours > 0
                  ? `Investigate ${p.leakageHours.toFixed(0)}h unbillable — convert to billable or remove`
                  : "No immediate action required"
              }
              evidence={[
                `Unbillable leakage: ${p.leakageHours.toFixed(0)}h (${Math.round(p.unbillablePct * 100)}%)`,
                `Shadow resources: ${p.shadowCount} | Ghost allocations: ${p.ghostCount}`,
                `Releasable FTE: ${p.releasableFTE.toFixed(1)}`,
                ...(p.ragFlags.length ? [`Risk flags: ${p.ragFlags.join(", ")}`] : []),
              ]}
            >
              {/* RAG indicators */}
              {latest && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(["schedule", "quality", "csat", "team"] as const).map((dim) => (
                    <span
                      key={dim}
                      className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", RAG_STYLES[latest[dim]])}
                    >
                      {dim}: {latest[dim]}
                    </span>
                  ))}
                </div>
              )}

              {/* Factors */}
              {p.contributingFactors.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Contributing factors:</p>
                  {p.contributingFactors.map((f, i) => (
                    <p key={i} className="text-xs text-slate-600">• {f}</p>
                  ))}
                </div>
              )}
            </DecisionCard>
          );
        })}
      </div>
    </div>
  );
}

export default function HealthPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Project Health Radar"
        description="RAG signals from weekly status + timesheet billability leakage + shadow/ghost resource detection."
      />
      <Suspense fallback={<div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}</div>}>
        <HealthRadarContent />
      </Suspense>
    </div>
  );
}
