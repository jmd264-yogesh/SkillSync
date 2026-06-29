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
import { SERVICE_LINES, PROPOSITION_PROJECT_TYPES, SOURCE_SYSTEMS } from "@/lib/constants";
import type { ServiceLine, PropositionRole, SourceSystem } from "@/lib/constants";
import type { RoleAllocation } from "@/server/actions/proposition-simulator";

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

function PctLabel({ pct, loading }: { pct: number; loading: boolean }) {
  if (loading) return <Skeleton className="h-3.5 w-8 rounded" />;
  return (
    <span
      className={`text-xs font-semibold tabular-nums w-9 text-right ${
        pct === 0 ? "text-slate-300" : "text-slate-800"
      }`}
    >
      {pct === 0 ? "—" : `${pct}%`}
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
          const pct = allocationMap.get(role) ?? 0;
          return (
            <div
              key={role}
              className={`flex items-center justify-between px-4 py-2 ${
                pct > 0 ? "bg-white" : "bg-slate-50/40"
              }`}
            >
              <span className={`text-xs ${pct > 0 ? "text-slate-800 font-medium" : "text-slate-400"}`}>
                {role}
              </span>
              <PctLabel pct={pct} loading={loading} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SimulatorClient() {
  const [proposition, setProposition] = useState<ServiceLine | "">("");
  const [projectType, setProjectType] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [weeks, setWeeks] = useState(12);

  const [sourceSystems, setSourceSystems] = useState<SourceSystem[]>([]);
  const [showSystems, setShowSystems] = useState(false);

  const [allocations, setAllocations] = useState<RoleAllocation[]>([]);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [totalFTE, setTotalFTE] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSystem(s: SourceSystem) {
    setSourceSystems((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  const projectTypes = proposition ? PROPOSITION_PROJECT_TYPES[proposition] : [];

  const allocationMap = new Map<PropositionRole, number>(
    allocations.map((a) => [a.role, a.percentage]),
  );

  const selectedProjectTypeLabel =
    projectTypes.find((t) => t.value === projectType)?.label ?? projectType;

  const canSimulate = !!proposition && !!projectType && weeks > 0;

  function handlePropositionChange(val: ServiceLine | "" | null) {
    setProposition(val ?? "");
    setProjectType("");
    setNarrative(null);
    setAllocations([]);
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
        sourceSystems: sourceSystems.length > 0 ? sourceSystems : undefined,
      });
      setAllocations(data.allocations);
      setNarrative(data.narrative);
      setTotalFTE(data.totalFTE);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Single-line config form */}
      <Card className="border-0 shadow-sm">
        <CardContent className="px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-44">
              <Label className="text-xs font-medium text-slate-600">Proposition</Label>
              <Select value={proposition} onValueChange={handlePropositionChange}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="Select proposition…" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_LINES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-44">
              <Label className="text-xs font-medium text-slate-600">Project Type</Label>
              <Select
                value={projectType}
                onValueChange={(v) => {
                  setProjectType(v ?? "");
                  setNarrative(null);
                  setAllocations([]);
                }}
                disabled={!proposition}
              >
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue
                    placeholder={proposition ? "Select type…" : "Pick proposition first"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {projectTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-36">
              <Label className="text-xs font-medium text-slate-600">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-sm mt-1"
              />
            </div>

            <div className="w-24">
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
          {/* Source systems — optional expandable section */}
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

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {/* AI narrative */}
      {narrative && !loading && (
        <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-violet-700 mb-1 uppercase tracking-wide">
            AI Recommendation
            {totalFTE !== null && totalFTE > 0 && (
              <span className="ml-2 normal-case font-normal text-violet-500">
                · {totalFTE} FTE estimated
              </span>
            )}
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">{narrative}</p>
        </div>
      )}

      {/* Role allocation — UK / Chennai split */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-5 py-3 pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">
            Role Allocation
            {!narrative && !loading && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — run the simulation to see percentages
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
