"use client";

import { useState, useMemo } from "react";
import { DecisionCard } from "@/components/shared/decision-card";
import { AgentTrace } from "@/components/shared/agent-trace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { triageHealth } from "@/server/actions/project-health";
import type { ProjectHealthResult } from "@/server/services/health.service";
import type { TriageResult, TriageIntervention } from "@/lib/ai/agent/health-triage";

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
        {start}-{end} of {total}
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
        {/* Page number chips - show up to 5 around current page */}
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

const SEVERITY_STYLES: Record<TriageIntervention["severity"], string> = {
  CRITICAL: "bg-red-50 border-red-200",
  HIGH: "bg-amber-50 border-amber-200",
  MEDIUM: "bg-blue-50 border-blue-100",
};
const SEVERITY_BADGE: Record<TriageIntervention["severity"], string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-300",
  HIGH: "bg-amber-100 text-amber-700 border-amber-300",
  MEDIUM: "bg-blue-100 text-blue-700 border-blue-300",
};

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
  const [search, setSearch] = useState("");
  const [flagFilter, setFlagFilter] = useState("ALL");
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.projectName.toLowerCase().includes(q));
    }
    if (flagFilter !== "ALL") {
      if (flagFilter === "HAS_FLAGS") list = list.filter((p) => p.ragFlags.length > 0);
      else if (flagFilter === "RAMP_DOWN") list = list.filter((p) => p.isRampDown);
      else if (flagFilter === "HIGH_LEAKAGE") list = list.filter((p) => p.leakageHours > 40);
      else list = list.filter((p) => p.ragFlags.some((f) => f.includes(flagFilter)));
    }
    return list;
  }, [projects, search, flagFilter]);

  async function handleRunTriage() {
    setTriageLoading(true);
    setTriageError(null);
    try {
      const result = await triageHealth();
      setTriage(result);
    } catch (e) {
      setTriageError(String(e));
    } finally {
      setTriageLoading(false);
    }
  }

  const rampSlice = rampDownProjects.slice(
    (rampPage - 1) * RAMP_DOWN_PAGE_SIZE,
    rampPage * RAMP_DOWN_PAGE_SIZE,
  );

  const projectSlice = filteredProjects.slice(
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

      {/* AI Triage section */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">AI Portfolio Triage</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Agent sweeps all projects, selects highest-risk, gathers evidence, and drafts interventions.
          </p>
        </div>
        <Button size="sm" onClick={handleRunTriage} disabled={triageLoading}>
          {triageLoading ? "Triaging…" : "Run Triage"}
        </Button>
      </div>

      {triageLoading && (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {triageError && (
        <p className="text-xs text-red-600 px-1">{triageError}</p>
      )}

      {triage && (
        <div className="space-y-3">
          {/* Portfolio headline */}
          <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">
                Portfolio Headline
              </p>
              <p className="text-sm font-medium text-slate-800">{triage.portfolioHeadline}</p>
              {triage.narrative && (
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{triage.narrative}</p>
              )}
            </div>
            <div className="flex gap-3 shrink-0 text-center">
              <div>
                <p className="text-lg font-bold text-violet-700">{triage.totalRecoverableFTE.toFixed(1)}</p>
                <p className="text-[10px] text-muted-foreground">FTE recoverable</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-700">{triage.projectsNeedingAction}</p>
                <p className="text-[10px] text-muted-foreground">need action</p>
              </div>
            </div>
          </div>

          {/* Intervention cards */}
          {triage.interventions.map((intervention, i) => (
            <div
              key={i}
              className={cn("border rounded-lg px-4 py-3 space-y-2", SEVERITY_STYLES[intervention.severity])}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">{intervention.projectName}</p>
                <Badge variant="outline" className={cn("text-[10px] shrink-0", SEVERITY_BADGE[intervention.severity])}>
                  {intervention.severity}
                </Badge>
              </div>
              <p className="text-xs text-slate-700">
                <span className="font-semibold">Root cause:</span> {intervention.rootCause}
              </p>
              <p className="text-xs text-slate-700">
                <span className="font-semibold">Action:</span> {intervention.recommendedIntervention}
              </p>
              {intervention.redeployTarget && (
                <p className="text-xs text-violet-700">
                  ↗ Redeploy opportunity: {intervention.redeployTarget}
                </p>
              )}
              {intervention.releasableFTE > 0 && (
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                  {intervention.releasableFTE.toFixed(1)} FTE releasable
                </Badge>
              )}
            </div>
          ))}

          <AgentTrace trace={triage.trace} label="How triage was conducted" />
        </div>
      )}

      {/* Ramp-down candidates - paginated */}
      {rampDownProjects.length > 0 && (
        <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-5 py-4">
          <p className="text-sm font-semibold text-blue-800 mb-2">
            {rampDownProjects.length} project{rampDownProjects.length !== 1 ? "s" : ""} winding down
            {" "}- {totalReleasable.toFixed(1)} FTE available for redeployment
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search project…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setProjectPage(1); }}
          className="h-8 text-sm w-52"
        />
        <Select
          value={flagFilter}
          onValueChange={(v) => { setFlagFilter(v ?? "ALL"); setProjectPage(1); }}
        >
          <SelectTrigger className="h-8 text-sm w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All projects</SelectItem>
            <SelectItem value="HAS_FLAGS">Has risk flags</SelectItem>
            <SelectItem value="RAMP_DOWN">Ramp-down</SelectItem>
            <SelectItem value="HIGH_LEAKAGE">High leakage (&gt;40h)</SelectItem>
            <SelectItem value="RED">Schedule RED</SelectItem>
            <SelectItem value="SHADOW">Shadow resources</SelectItem>
          </SelectContent>
        </Select>
        {(search || flagFilter !== "ALL") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => { setSearch(""); setFlagFilter("ALL"); setProjectPage(1); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Project cards - paginated */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""}
            {filteredProjects.length !== projects.length ? ` (filtered from ${projects.length})` : ""} - page {projectPage} of {Math.max(1, Math.ceil(filteredProjects.length / PROJECT_PAGE_SIZE))}
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
                  ? `Ramp-down: ${p.releasableFTE.toFixed(1)} FTE releasable - plan redeployment now`
                  : p.shadowCount > 0
                  ? `Formalise ${p.shadowCount} shadow resource(s) or remove unbillable hours`
                  : p.leakageHours > 0
                  ? `Investigate ${p.leakageHours.toFixed(0)}h unbillable - convert to billable or remove`
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
          total={filteredProjects.length}
          pageSize={PROJECT_PAGE_SIZE}
          onPage={(p) => { setProjectPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        />
      </div>
    </div>
  );
}
