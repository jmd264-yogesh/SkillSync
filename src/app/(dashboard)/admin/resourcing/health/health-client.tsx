"use client";

import { useState } from "react";
import { DecisionCard } from "@/components/shared/decision-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectHealthResult } from "@/server/services/health.service";

const RAG_STYLES = {
  GREEN:   "bg-green-100 text-green-700",
  AMBER:   "bg-amber-100 text-amber-700",
  RED:     "bg-red-100 text-red-700",
  UNKNOWN: "bg-slate-100 text-slate-500",
} as const;

const RAMP_DOWN_PAGE_SIZE = 20;
const PROJECT_PAGE_SIZE = 8;

interface HealthClientProps {
  projects: ProjectHealthResult[];
  withFlags: number;
  totalLeakage: number;
  totalShadow: number;
  totalReleasable: number;
  rampDownProjects: ProjectHealthResult[];
}

function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between pt-3 border-t mt-3">
      <p className="text-xs text-muted-foreground">
        {start}–{end} of {total}
      </p>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          ← Prev
        </Button>
        {/* Page number chips — show up to 5 around current page */}
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | "…")[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground self-center">…</span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                className="h-7 w-7 p-0 text-xs"
                onClick={() => onPage(p as number)}
              >
                {p}
              </Button>
            )
          )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={page === totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}

export function HealthClient({
  projects,
  withFlags,
  totalLeakage,
  totalShadow,
  totalReleasable,
  rampDownProjects,
}: HealthClientProps) {
  const [rampPage, setRampPage] = useState(1);
  const [projectPage, setProjectPage] = useState(1);

  const rampSlice = rampDownProjects.slice(
    (rampPage - 1) * RAMP_DOWN_PAGE_SIZE,
    rampPage * RAMP_DOWN_PAGE_SIZE,
  );

  const projectSlice = projects.slice(
    (projectPage - 1) * PROJECT_PAGE_SIZE,
    projectPage * PROJECT_PAGE_SIZE,
  );

  return (
    <div className="space-y-5">
      {/* Summary strip */}
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

      {/* Ramp-down candidates — paginated */}
      {rampDownProjects.length > 0 && (
        <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-5 py-4">
          <p className="text-sm font-semibold text-blue-800 mb-2">
            {rampDownProjects.length} project{rampDownProjects.length !== 1 ? "s" : ""} winding down
            {" "}— {totalReleasable.toFixed(1)} FTE available for redeployment
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {rampSlice.map((p) => (
              <div
                key={p.projectId}
                className="flex items-center justify-between bg-white rounded border border-blue-100 px-3 py-2 text-xs"
              >
                <span className="text-slate-700 font-medium truncate mr-3">{p.projectName}</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                  {p.releasableFTE.toFixed(1)} FTE
                </Badge>
              </div>
            ))}
          </div>
          <Pagination
            page={rampPage}
            total={rampDownProjects.length}
            pageSize={RAMP_DOWN_PAGE_SIZE}
            onPage={(p) => { setRampPage(p); }}
          />
          <p className="text-xs text-muted-foreground mt-3">
            Use the Match Engine to assign these resources to upcoming pipeline requests.
          </p>
        </div>
      )}

      {/* Project cards — paginated */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {projects.length} projects — page {projectPage} of {Math.ceil(projects.length / PROJECT_PAGE_SIZE)}
          </p>
        </div>

        {projectSlice.map((p) => {
          const latest = p.ragTrend[p.ragTrend.length - 1];
          const hasRisk = p.ragFlags.length > 0;
          const variant =
            p.ragFlags.includes("SCHEDULE_RED") || p.leakageHours > 80
              ? "NO"
              : hasRisk
              ? "YES_WITH_CONDITIONS"
              : "YES";

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
              {latest && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(["schedule", "quality", "csat", "team"] as const).map((dim) => (
                    <span
                      key={dim}
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full",
                        RAG_STYLES[latest[dim] as keyof typeof RAG_STYLES] ?? RAG_STYLES.UNKNOWN,
                      )}
                    >
                      {dim}: {latest[dim]}
                    </span>
                  ))}
                </div>
              )}
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

        <Pagination
          page={projectPage}
          total={projects.length}
          pageSize={PROJECT_PAGE_SIZE}
          onPage={(p) => { setProjectPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        />
      </div>
    </div>
  );
}
