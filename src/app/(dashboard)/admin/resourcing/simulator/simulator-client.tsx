"use client";

import { useState } from "react";
import { simulateProposition, findResourcesForSimulation } from "@/server/actions/proposition-simulator";
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
  RoleResourceMatch,
} from "@/server/actions/proposition-simulator";

// UK = senior client-facing consulting roles
const UK_ROLES: PropositionRole[] = [
  "Partner",
  "Associate Partner",
  "Principal",
  "Manager",
  "Senior Consultant",
  "Consultant",
];

// Chennai = delivery, junior consulting, and technology roles
const CHENNAI_ROLES: PropositionRole[] = [
  "Senior Associate Consultant",
  "Associate Consultant",
  "Intern",
  "Partner Technology",
  "Associate Partner Technology",
  "Principal Technology Architect",
  "Technical Solutions Architect",
  "Senior Solutions Consultant",
  "Solutions Consultant",
  "Solutions Enabler",
  "Senior Software Engineer",
  "Software Engineer",
  "Intern Technology",
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
  hideEmpty = false,
}: {
  title: string;
  flag: string;
  roles: PropositionRole[];
  allocationMap: Map<PropositionRole, number>;
  loading: boolean;
  hideEmpty?: boolean;
}) {
  const visibleRoles = hideEmpty
    ? roles.filter((r) => (allocationMap.get(r) ?? 0) > 0)
    : roles;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-slate-50 border-b flex items-center gap-2">
        <span className="text-base leading-none">{flag}</span>
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</span>
      </div>
      {visibleRoles.length === 0 ? (
        <div className="px-4 py-3 text-xs text-slate-400 text-center">
          No active roles for this location
        </div>
      ) : (
        <div className="divide-y">
          {visibleRoles.map((role) => {
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
      )}
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

// ── Tech stack picker ─────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  SKILL:         "Skills",
  FRAMEWORK:     "Frameworks",
  CONCEPT:       "Concepts",
  TOOL:          "Tools",
  CERTIFICATION: "Certifications",
};

function TechStackPicker({
  skills,
  selected,
  onChange,
}: {
  skills: { id: string; name: string; category: string }[];
  selected: { skillId: string; skillName: string }[];
  onChange: (updated: { skillId: string; skillName: string }[]) => void;
}) {
  const selectedIds = new Set(selected.map((s) => s.skillId));

  function toggle(skill: { id: string; name: string }) {
    if (selectedIds.has(skill.id)) {
      onChange(selected.filter((s) => s.skillId !== skill.id));
    } else {
      onChange([...selected, { skillId: skill.id, skillName: skill.name }]);
    }
  }

  // Group by category in a consistent order
  const categoryOrder = ["TOOL", "FRAMEWORK", "SKILL", "CONCEPT", "CERTIFICATION"];
  const grouped = categoryOrder.reduce<Record<string, typeof skills>>((acc, cat) => {
    const items = skills.filter((s) => s.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="mt-2.5 space-y-3">
      {Object.entries(grouped).map(([cat, catSkills]) => (
        <div key={cat}>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            {CATEGORY_LABELS[cat] ?? cat}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {catSkills.map((s) => {
              const active = selectedIds.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs px-2.5 py-1 rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-red-500 hover:border-red-300 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

// ── Resource mode toggle ──────────────────────────────────────────────────────

type ResourceMode = "ai" | "baseline";

function ResourceModeToggle({
  mode,
  onMode,
  hasBaseline,
}: {
  mode: ResourceMode;
  onMode: (m: ResourceMode) => void;
  hasBaseline: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
      <button
        type="button"
        onClick={() => onMode("ai")}
        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
          mode === "ai"
            ? "bg-white text-violet-700 shadow-sm border border-slate-200"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        AI Recommendation
      </button>
      <button
        type="button"
        onClick={() => onMode("baseline")}
        disabled={!hasBaseline}
        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
          mode === "baseline"
            ? "bg-white text-blue-700 shadow-sm border border-slate-200"
            : "text-slate-500 hover:text-slate-700"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
        title={!hasBaseline ? "No historical baseline for this combination" : undefined}
      >
        Historical Baseline
      </button>
    </div>
  );
}

interface SimulatorClientProps {
  skills: { id: string; name: string; category: string }[];
}

export function SimulatorClient({ skills }: SimulatorClientProps) {
  const [proposition, setProposition] = useState<ServiceLine | "">("");
  const [projectType, setProjectType] = useState("");
  const [phase, setPhase] = useState<EngagementPhase | "">("");
  const [criticality, setCriticality] = useState<CriticalityLevel | "">("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [weeks, setWeeks] = useState(12);

  const [sourceSystems, setSourceSystems] = useState<SourceSystem[]>([]);
  const [showSystems, setShowSystems] = useState(false);
  const [techStack, setTechStack] = useState<{ skillId: string; skillName: string }[]>([]);
  const [showTechStack, setShowTechStack] = useState(false);
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);

  const [allocations, setAllocations] = useState<RoleAllocation[]>([]);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [totalHeadcount, setTotalHeadcount] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<BaselineAllocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resources, setResources] = useState<RoleResourceMatch[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourceMode, setResourceMode] = useState<ResourceMode>("ai");

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
    setResources([]);
    setTechStack([]);
  }

  async function handleSimulate() {
    if (!canSimulate) return;
    setLoading(true);
    setError(null);
    setResources([]);
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
        techStack: techStack.length > 0 ? techStack.map((t) => t.skillName) : undefined,
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

  async function handleFindResources() {
    let source: { role: string; fte: number }[];
    if (resourceMode === "baseline" && baseline) {
      source = baseline.resources.filter((r) => r.fte > 0);
    } else {
      source = allocations.filter((a) => a.fte > 0);
    }
    if (source.length === 0) return;
    setResourcesLoading(true);
    const skillsForMatching =
      techStack.length > 0
        ? techStack.map((t) => ({ skillId: t.skillId, skillName: t.skillName, requiredLevel: 3 }))
        : undefined;
    try {
      const data = await findResourcesForSimulation(source, skillsForMatching);
      setResources(data);
    } catch {
      // silently ignore — show empty state
    } finally {
      setResourcesLoading(false);
    }
  }

  const hasResults = narrative !== null;
  const hasActiveAllocations = allocations.some((a) => a.fte > 0);

  return (
    <div className="space-y-4">
      {/* ── Config form ─────────────────────────────────────────── */}
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
                  setResources([]);
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
            <div className="w-44">
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
            <div className="w-36">
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
              <span className="text-slate-400">(optional — affects Chennai engineering headcount)</span>
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

          {/* Tech Stack */}
          <div className="mt-3 border-t pt-3">
            <button
              type="button"
              onClick={() => setShowTechStack((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <span className="font-medium">Tech Stack</span>
              <span className="text-slate-400">(optional — improves candidate matching)</span>
              <span className="ml-1 text-slate-400">{showTechStack ? "▲" : "▼"}</span>
              {techStack.length > 0 && (
                <span className="ml-1 bg-indigo-100 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {techStack.length} selected
                </span>
              )}
            </button>

            {showTechStack && (
              <TechStackPicker
                skills={skills}
                selected={techStack}
                onChange={setTechStack}
              />
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
                  placeholder="Describe the project, client context, key deliverables, number of source systems, specific technologies, or delivery constraints that should influence the team composition…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-sm resize-none"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  This context is sent to AI. Mention source system counts here to scale Chennai engineering roles accordingly.
                </p>
              </div>
            )}
          </div>

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {/* ── Pre-run role panels (all zeroes) ─────────────────────── */}
      {!hasResults && !loading && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 py-3 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">
              Role Allocation
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — run the simulation to see allocations
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

      {/* ── Post-run results grid ────────────────────────────────── */}
      {(hasResults || loading) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Historical Baseline */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="px-5 py-3 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-slate-700">Historical Baseline</CardTitle>
                {!loading && (
                  <span className="text-xs text-muted-foreground">
                    {baseline ? "— exact match found" : "— no match for this combination"}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {loading ? (
                <div className="space-y-2">
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
                    <span className="font-medium">
                      {projectType} · {phase || "any phase"} · {criticality || "any criticality"}
                    </span>.
                    <br />
                    The AI recommendation uses the nearest reference pattern.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: AI Recommendation */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="px-5 py-3 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-slate-700">AI Recommendation</CardTitle>
                {!loading && totalHeadcount !== null && totalHeadcount > 0 && (
                  <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-200 bg-violet-50 h-5">
                    {totalHeadcount} headcount
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {narrative && !loading && (
                <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-violet-700 mb-1 uppercase tracking-wide">
                    Rationale
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
                  hideEmpty={!loading && hasResults}
                />
                <LocationPanel
                  title="Chennai"
                  flag="🇮🇳"
                  roles={CHENNAI_ROLES}
                  allocationMap={allocationMap}
                  loading={loading}
                  hideEmpty={!loading && hasResults}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Find Resources section ───────────────────────────────── */}
      {hasResults && !loading && hasActiveAllocations && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 py-3 pb-2">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-700">Find Available Resources</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Search the talent pool for candidates matching the recommended roles.
                </p>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Based on
                  </span>
                  <ResourceModeToggle
                    mode={resourceMode}
                    onMode={(m) => {
                      setResourceMode(m);
                      setResources([]);
                    }}
                    hasBaseline={baseline !== null}
                  />
                </div>
                <Button
                  size="sm"
                  variant={resources.length === 0 ? "default" : "outline"}
                  onClick={handleFindResources}
                  disabled={resourcesLoading}
                  className="h-9 px-4"
                >
                  {resourcesLoading
                    ? "Searching…"
                    : resources.length > 0
                    ? "Refresh"
                    : "Find Resources"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {resourcesLoading && (
              <div className="mt-1 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            )}

            {!resourcesLoading && resources.length === 0 && (
              <div className="py-6 text-center border border-dashed border-slate-200 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Select a source above and click{" "}
                  <span className="font-medium">Find Resources</span> to search the talent pool.
                </p>
              </div>
            )}

            {!resourcesLoading && resources.length > 0 && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pb-2 border-b">
                  <span>Results from</span>
                  <span
                    className={`font-semibold ${
                      resourceMode === "ai" ? "text-violet-700" : "text-blue-700"
                    }`}
                  >
                    {resourceMode === "ai" ? "AI Recommendation" : "Historical Baseline"}
                  </span>
                  <span>allocations · top 5 per role</span>
                  {techStack.length > 0 && (
                    <span className="ml-1 flex flex-wrap gap-1">
                      <span className="text-slate-400">· filtered by:</span>
                      {techStack.map((t) => (
                        <span
                          key={t.skillId}
                          className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        >
                          {t.skillName}
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                {resources.map((rm) => (
                  <div key={rm.role}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-xs font-semibold text-slate-800">{rm.role}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-4 border ${
                          resourceMode === "ai"
                            ? "text-violet-700 border-violet-200 bg-violet-50"
                            : "text-blue-700 border-blue-200 bg-blue-50"
                        }`}
                      >
                        {rm.fte >= 1 ? `${rm.fte}× 100%` : `${Math.round(rm.fte * 100)}%`}
                      </Badge>
                      {rm.candidates.length === 0 && (
                        <span className="text-[10px] text-amber-600 font-medium">
                          No internal candidates — consider external hire
                        </span>
                      )}
                    </div>
                    {rm.candidates.length > 0 && (
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b">
                              <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide w-24">
                                Emp ID
                              </th>
                              <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                Name
                              </th>
                              <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                                Role / COE
                              </th>
                              <th className="text-center px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide w-16">
                                Score
                              </th>
                              <th className="text-center px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide w-20">
                                Available
                              </th>
                              <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                Recommendation
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {rm.candidates.map((c) => {
                              const signalColor =
                                c.signal === "REDEPLOY"
                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                  : c.signal === "PARTIAL_HIRE"
                                  ? "text-amber-700 bg-amber-50 border-amber-200"
                                  : "text-red-700 bg-red-50 border-red-200";
                              const hasRisk = c.riskFlags.length > 0;
                              return (
                                <tr
                                  key={c.employeeId}
                                  className={`${
                                    hasRisk ? "bg-amber-50/30" : "bg-white"
                                  } hover:bg-slate-50/60 transition-colors`}
                                >
                                  <td className="px-3 py-2.5 font-mono font-semibold text-slate-700">
                                    {c.employeeCode}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className="font-medium text-slate-800">{c.name}</span>
                                    {hasRisk && (
                                      <span className="ml-1.5 text-[9px] text-amber-600 font-semibold uppercase">
                                        {c.riskFlags.slice(0, 2).join(" · ")}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-500 hidden sm:table-cell">
                                    {c.jobName ?? c.designationName ?? "—"}
                                    {c.coeName && (
                                      <span className="text-slate-400 ml-1">· {c.coeName}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span
                                      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${signalColor}`}
                                    >
                                      {c.matchScore}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-slate-600 font-medium">
                                    {c.availableFTE}%
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-600 leading-snug max-w-xs">
                                    {c.recommendation}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
