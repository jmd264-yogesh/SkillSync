"use client";

import { useState } from "react";
import { simulateProposition } from "@/server/actions/proposition-simulator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  SERVICE_LINES,
  PROPOSITION_PROJECT_TYPES,
  SOURCE_SYSTEMS,
  ENGAGEMENT_PHASES,
  CRITICALITY_LEVELS,
} from "@/lib/constants";
import type {
  ServiceLine,
  PropositionRole,
  SourceSystem,
  EngagementPhase,
  CriticalityLevel,
} from "@/lib/constants";
import type {
  RoleAllocation,
  BaselineAllocation,
} from "@/server/actions/proposition-simulator";

// UK = senior client-facing consulting roles (partner-level at bottom)
const UK_ROLES: PropositionRole[] = [
  "Senior Consultant",
  "Consultant",
  "Partner",
  "Associate Partner",
  "Principal",
  "Manager",
];

// Chennai = delivery, junior consulting, and technology roles (tech-partner tier at bottom)
const CHENNAI_ROLES: PropositionRole[] = [
  "Senior Associate Consultant",
  "Associate Consultant",
  "Intern",
  "Senior Solutions Consultant",
  "Solutions Consultant",
  "Solutions Enabler",
  "Senior Software Engineer",
  "Software Engineer",
  "Intern Technology",
  "Partner Technology",
  "Associate Partner Technology",
  "Principal Technology Architect",
  "Technical Solutions Architect",
];

const CRITICALITY_COLORS: Record<CriticalityLevel, string> = {
  Stable: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Medium: "text-amber-700 bg-amber-50 border-amber-200",
  High:   "text-red-700 bg-red-50 border-red-200",
};

function AllocLabel({ fte, loading }: { fte: number; loading: boolean }) {
  if (loading) return <Skeleton className="h-3.5 w-16 rounded" />;
  if (fte === 0) return <span className="text-xs tabular-nums text-slate-300 w-16 text-right">—</span>;
  const display = fte >= 1 ? `${fte}× 100%` : `${Math.round(fte * 100)}%`;
  return (
    <span className="text-xs font-semibold tabular-nums text-slate-800 text-right">
      {display}
    </span>
  );
}

function LocationPanel({
  title,
  flag,
  roles,
  allocationMap,
  loading,
}: {
  title: string;
  flag: string;
  roles: PropositionRole[];
  allocationMap: Map<PropositionRole, number>;
  loading: boolean;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-slate-50 border-b flex items-center gap-2">
        <span className="text-base leading-none">{flag}</span>
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</span>
      </div>
      <div className="divide-y">
        {roles.map((role) => {
          const fte = allocationMap.get(role) ?? 0;
          return (
            <div
              key={role}
              className={`flex items-center justify-between px-4 py-2 ${
                fte > 0 ? "bg-white" : "bg-slate-50/40"
              }`}
            >
              <span className={`text-xs ${fte > 0 ? "text-slate-800 font-medium" : "text-slate-400"}`}>
                {role}
              </span>
              <AllocLabel fte={fte} loading={loading} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BaselinePanel({ baseline }: { baseline: BaselineAllocation }) {
  return (
    <div className="rounded-lg border border-blue-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
        <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
          Historical Baseline
        </span>
        <span className="text-xs text-blue-600">
          {baseline.solution} · {baseline.phase} · {baseline.criticality}
        </span>
        <Badge variant="outline" className="ml-auto text-[10px] text-blue-700 border-blue-300 bg-blue-50 h-5">
          {baseline.totalFTE} headcount
        </Badge>
      </div>
      <div className="divide-y bg-white">
        {baseline.resources.map((r) => (
          <div key={r.role} className="flex items-center justify-between px-4 py-2">
            <span className="text-xs text-slate-700">{r.role}</span>
            <span className="text-xs font-semibold tabular-nums text-blue-700 text-right">
              {r.fte >= 1 ? `${r.fte}× 100%` : `${Math.round(r.fte * 100)}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SimulatorClient() {
  const [proposition, setProposition] = useState<ServiceLine | "">("");
  const [projectType, setProjectType] = useState("");
  const [phase, setPhase] = useState<EngagementPhase | "">("");
  const [criticality, setCriticality] = useState<CriticalityLevel | "">("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [weeks, setWeeks] = useState(12);

  const [sourceSystems, setSourceSystems] = useState<SourceSystem[]>([]);
  const [showSystems, setShowSystems] = useState(false);
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);

  const [allocations, setAllocations] = useState<RoleAllocation[]>([]);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [totalHeadcount, setTotalHeadcount] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<BaselineAllocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSystem(s: SourceSystem) {
    setSourceSystems((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  const projectTypes = proposition ? PROPOSITION_PROJECT_TYPES[proposition] : [];

  const allocationMap = new Map<PropositionRole, number>(
    allocations.map((a) => [a.role, a.fte]),
  );

  const selectedProjectTypeLabel =
    projectTypes.find((t) => t.value === projectType)?.label ?? projectType;

  const canSimulate = !!proposition && !!projectType && weeks > 0;

  function handlePropositionChange(val: ServiceLine | "" | null) {
    setProposition(val ?? "");
    setProjectType("");
    setNarrative(null);
    setAllocations([]);
    setBaseline(null);
  }

  async function handleSimulate() {
    if (!canSimulate) return;
    setLoading(true);
    setError(null);
    try {
      const data = await simulateProposition({
        proposition,
        projectType,
        projectTypeLabel: selectedProjectTypeLabel,
        startDate,
        weeks,
        phase: phase || undefined,
        criticality: criticality || undefined,
        sourceSystems: sourceSystems.length > 0 ? sourceSystems : undefined,
        description: description.trim() || undefined,
      });
      setAllocations(data.allocations);
      setNarrative(data.narrative);
      setTotalHeadcount(data.totalHeadcount);
      setBaseline(data.baseline);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Config form */}
      <Card className="border-0 shadow-sm">
        <CardContent className="px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Proposition */}
            <div className="flex-1 min-w-40">
              <Label className="text-xs font-medium text-slate-600">Proposition</Label>
              <Select value={proposition} onValueChange={handlePropositionChange}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="Select proposition…" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_LINES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Type */}
            <div className="flex-1 min-w-40">
              <Label className="text-xs font-medium text-slate-600">Project Type</Label>
              <Select
                value={projectType}
                onValueChange={(v) => {
                  setProjectType(v ?? "");
                  setNarrative(null);
                  setAllocations([]);
                  setBaseline(null);
                }}
                disabled={!proposition}
              >
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder={proposition ? "Select type…" : "Pick proposition first"} />
                </SelectTrigger>
                <SelectContent>
                  {projectTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Engagement Phase */}
            <div className="w-40">
              <Label className="text-xs font-medium text-slate-600">Phase</Label>
              <Select value={phase} onValueChange={(v) => setPhase((v ?? "") as EngagementPhase | "")}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="Select phase…" />
                </SelectTrigger>
                <SelectContent>
                  {ENGAGEMENT_PHASES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Criticality */}
            <div className="w-32">
              <Label className="text-xs font-medium text-slate-600">Criticality</Label>
              <Select value={criticality} onValueChange={(v) => setCriticality((v ?? "") as CriticalityLevel | "")}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="Level…" />
                </SelectTrigger>
                <SelectContent>
                  {CRITICALITY_LEVELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${CRITICALITY_COLORS[c]}`}>
                        {c}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="w-34">
              <Label className="text-xs font-medium text-slate-600">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-sm mt-1"
              />
            </div>

            {/* Weeks */}
            <div className="w-20">
              <Label className="text-xs font-medium text-slate-600">Weeks</Label>
              <Input
                type="number"
                min={1}
                max={104}
                value={weeks}
                onChange={(e) => setWeeks(parseInt(e.target.value) || 1)}
                className="h-9 text-sm mt-1"
              />
            </div>

            <div className="flex flex-col justify-end">
              <Button
                size="sm"
                onClick={handleSimulate}
                disabled={loading || !canSimulate}
                className="h-9 px-5"
              >
                {loading ? "Generating…" : "Run Simulation"}
              </Button>
            </div>
          </div>

          {/* Source Systems */}
          <div className="mt-3 border-t pt-3">
            <button
              type="button"
              onClick={() => setShowSystems((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <span className="font-medium">Source Systems</span>
              <span className="text-slate-400">(optional)</span>
              <span className="ml-1 text-slate-400">{showSystems ? "▲" : "▼"}</span>
              {sourceSystems.length > 0 && (
                <span className="ml-1 bg-violet-100 text-violet-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {sourceSystems.length} selected
                </span>
              )}
            </button>

            {showSystems && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {SOURCE_SYSTEMS.map((s) => {
                  const active = sourceSystems.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSystem(s)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
                {sourceSystems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSourceSystems([])}
                    className="text-xs px-2.5 py-1 rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-red-500 hover:border-red-300 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Additional Context */}
          <div className="mt-3 border-t pt-3">
            <button
              type="button"
              onClick={() => setShowDescription((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <span className="font-medium">Additional Context</span>
              <span className="text-slate-400">(optional)</span>
              <span className="ml-1 text-slate-400">{showDescription ? "▲" : "▼"}</span>
              {description.trim().length > 0 && (
                <span className="ml-1 bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  added
                </span>
              )}
            </button>

            {showDescription && (
              <div className="mt-2.5">
                <Textarea
                  rows={3}
                  placeholder="Describe the project, client context, key deliverables, specific technologies, or delivery constraints that should influence the team composition…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-sm resize-none"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  This context is sent to AI to refine the allocation recommendation.
                </p>
              </div>
            )}
          </div>

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {/* Results — only shown after running */}
      {(narrative || loading) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Baseline */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Historical Baseline</span>
              {!loading && (
                <span className="text-xs text-muted-foreground">
                  {baseline ? "— exact match found" : "— no exact match for this combination"}
                </span>
              )}
            </div>
            {loading ? (
              <div className="rounded-lg border p-4 space-y-2">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full rounded" />
                ))}
              </div>
            ) : baseline ? (
              <BaselinePanel baseline={baseline} />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                <p className="text-xs text-muted-foreground">
                  No historical match for{" "}
                  <span className="font-medium">{projectType} · {phase || "any phase"} · {criticality || "any criticality"}</span>.
                  <br />
                  The AI recommendation below uses the nearest reference pattern.
                </p>
              </div>
            )}
          </div>

          {/* Right: AI Recommendation */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">AI Recommendation</span>
              {!loading && totalHeadcount !== null && totalHeadcount > 0 && (
                <span className="text-xs text-muted-foreground">
                  · {totalHeadcount} headcount
                </span>
              )}
            </div>

            {narrative && !loading && (
              <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-violet-700 mb-1 uppercase tracking-wide">
                  AI Rationale
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">{narrative}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <LocationPanel
                title="UK"
                flag="🇬🇧"
                roles={UK_ROLES}
                allocationMap={allocationMap}
                loading={loading}
              />
              <LocationPanel
                title="Chennai"
                flag="🇮🇳"
                roles={CHENNAI_ROLES}
                allocationMap={allocationMap}
                loading={loading}
              />
            </div>
          </div>
        </div>
      )}

      {/* Pre-run role panels (always visible, all zeroes) */}
      {!narrative && !loading && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 py-3 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">
              Role Allocation
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — run the simulation to see percentages
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LocationPanel
                title="UK"
                flag="🇬🇧"
                roles={UK_ROLES}
                allocationMap={allocationMap}
                loading={false}
              />
              <LocationPanel
                title="Chennai"
                flag="🇮🇳"
                roles={CHENNAI_ROLES}
                allocationMap={allocationMap}
                loading={false}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
