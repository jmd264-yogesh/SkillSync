"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, X, RefreshCw, Save, Trash2, TrendingDown, Users, Sparkles } from "lucide-react";
import { compareScenariosAction, type ScenarioForecast } from "@/server/actions/forecast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STAGES: { key: string; label: string; hint: string }[] = [
  { key: "PROPOSAL", label: "Make It Real", hint: "Proposal, ~20% win" },
  { key: "SOW_PENDING", label: "Build Proposition", hint: "SOW pending, ~40% win" },
  { key: "SOW_SIGNED", label: "SOW Signed", hint: "Signed, ~80% win" },
  { key: "ACTIVE", label: "Active Delivery", hint: "Live delivery" },
  { key: "RAMP_DOWN", label: "Extension / Ramp Down", hint: "Post-delivery" },
];

const PRESETS: { name: string; stages: string[] }[] = [
  { name: "Conservative", stages: ["SOW_SIGNED", "ACTIVE", "RAMP_DOWN"] },
  { name: "Balanced", stages: ["SOW_PENDING", "SOW_SIGNED", "ACTIVE", "RAMP_DOWN"] },
  { name: "Aggressive", stages: ["PROPOSAL", "SOW_PENDING", "SOW_SIGNED", "ACTIVE", "RAMP_DOWN"] },
];

const HORIZONS = [3, 6, 12];
const STORAGE_KEY = "skillsync.scenarioSets";

interface Def {
  id: string;
  name: string;
  wonStages: string[];
  horizonMonths: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function fmtMonth(key: string | null): string {
  if (!key) return "none";
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function ScenarioPlannerClient({ initial }: { initial: ScenarioForecast[] }) {
  const [defs, setDefs] = useState<Def[]>(
    initial.map((s) => ({ id: s.id, name: s.name, wonStages: s.wonStages, horizonMonths: s.forecast.horizonMonths })),
  );
  const [results, setResults] = useState<ScenarioForecast[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [savedSets, setSavedSets] = useState<Record<string, Def[]>>({});
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedSets(JSON.parse(raw) as Record<string, Def[]>);
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  function persistSets(next: Record<string, Def[]>) {
    setSavedSets(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable */
    }
  }

  function recompute(nextDefs: Def[]) {
    startTransition(async () => {
      const res = await compareScenariosAction({ scenarios: nextDefs });
      setResults(res);
      setDirty(false);
    });
  }

  function updateDef(id: string, patch: Partial<Def>) {
    setDefs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    setDirty(true);
  }
  function toggleStage(id: string, stage: string) {
    setDefs((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, wonStages: d.wonStages.includes(stage) ? d.wonStages.filter((s) => s !== stage) : [...d.wonStages, stage] }
          : d,
      ),
    );
    setDirty(true);
  }
  function applyPreset(id: string, stages: string[]) {
    updateDef(id, { wonStages: stages });
  }
  function addScenario() {
    if (defs.length >= 4) return;
    const n = defs.length + 1;
    setDefs((prev) => [...prev, { id: `s-${Date.now()}`, name: `Scenario ${n}`, wonStages: PRESETS[1]!.stages, horizonMonths: 6 }]);
    setDirty(true);
  }
  function removeScenario(id: string) {
    if (defs.length <= 1) return;
    setDefs((prev) => prev.filter((d) => d.id !== id));
    setDirty(true);
  }
  function saveSet() {
    const name = saveName.trim();
    if (!name) return;
    persistSets({ ...savedSets, [name]: defs });
    setSaveName("");
  }
  function loadSet(name: string) {
    const set = savedSets[name];
    if (!set) return;
    setDefs(set);
    recompute(set);
  }
  function deleteSet(name: string) {
    const next = { ...savedSets };
    delete next[name];
    persistSets(next);
  }

  // Baseline = first scenario; deltas measured against it.
  const baseline = results[0];
  const byId = new Map(results.map((r) => [r.id, r]));

  // Headline takeaway: scenario that differs most from baseline on hiring need.
  const takeaway = (() => {
    if (results.length < 2 || !baseline) return null;
    const others = results.filter((r) => r.id !== baseline.id);
    if (others.length === 0) return null;
    const pick = others.reduce(
      (a, b) =>
        Math.abs(b.forecast.totalHireCount - baseline.forecast.totalHireCount) >
        Math.abs(a.forecast.totalHireCount - baseline.forecast.totalHireCount)
          ? b : a,
      others[0]!,
    );
    const hireDelta = pick.forecast.totalHireCount - baseline.forecast.totalHireCount;
    const shortDelta = round1(pick.forecast.totalShortfallFTE - baseline.forecast.totalShortfallFTE);
    return { pick, hireDelta, shortDelta };
  })();

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="px-5 py-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => recompute(defs)}
            className={cn(
              "h-9 px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all",
              dirty ? "bg-primary text-white shadow-sm animate-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} />
            {dirty ? "Update comparison" : "Comparison up to date"}
          </button>
          <button
            type="button"
            onClick={addScenario}
            disabled={defs.length >= 4}
            className="h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Add scenario
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveSet(); }}
                placeholder="Save as..."
                className="w-36 h-9 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={saveSet}
              disabled={!saveName.trim()}
              className="h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>

          {Object.keys(savedSets).length > 0 && (
            <div className="w-full flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 mt-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Saved sets</span>
              {Object.keys(savedSets).map((name) => (
                <span key={name} className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 text-xs">
                  <button type="button" onClick={() => loadSet(name)} className="pl-2.5 pr-1.5 py-1 font-medium text-slate-700 hover:text-primary">
                    {name}
                  </button>
                  <button type="button" onClick={() => deleteSet(name)} className="pr-1.5 py-1 text-slate-300 hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Headline takeaway ── */}
      {takeaway && (
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 to-slate-50 px-5 py-3.5 flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-900 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            <span className="font-bold text-slate-900">{takeaway.pick.name}</span>{" "}
            {takeaway.hireDelta > 0 ? (
              <>needs <span className="font-bold text-amber-700">{takeaway.hireDelta} more hire{takeaway.hireDelta !== 1 ? "s" : ""}</span> than {baseline?.name}{takeaway.pick.forecast.hireByDate ? <>, first gap by {fmtMonth(takeaway.pick.forecast.hireByDate)}</> : null}.</>
            ) : takeaway.hireDelta < 0 ? (
              <>needs <span className="font-bold text-emerald-700">{Math.abs(takeaway.hireDelta)} fewer hire{Math.abs(takeaway.hireDelta) !== 1 ? "s" : ""}</span> than {baseline?.name}.</>
            ) : (
              <>matches {baseline?.name} on hiring{takeaway.shortDelta !== 0 ? <>, but shifts the shortfall by {takeaway.shortDelta} FTE</> : null}.</>
            )}
          </p>
        </div>
      )}

      {/* ── Scenario columns ── */}
      <div className={cn("grid gap-4", results.length >= 3 ? "grid-cols-1 lg:grid-cols-3" : results.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
        {defs.map((def, idx) => {
          const res = byId.get(def.id);
          const f = res?.forecast;
          const base = baseline?.forecast;
          const isBaseline = baseline?.id === def.id;
          const hireDelta = f && base ? f.totalHireCount - base.totalHireCount : 0;
          const shortDelta = f && base ? round1(f.totalShortfallFTE - base.totalShortfallFTE) : 0;

          return (
            <Card key={def.id} className={cn("border shadow-sm overflow-hidden", isBaseline ? "border-slate-200" : "border-indigo-100")}>
              {/* Header: name + remove */}
              <div className="px-4 pt-3.5 pb-3 border-b border-slate-100 flex items-center gap-2">
                <Input
                  value={def.name}
                  onChange={(e) => updateDef(def.id, { name: e.target.value })}
                  className="h-8 text-sm font-semibold border-transparent hover:border-slate-200 focus:border-slate-300 px-1.5 -ml-1"
                />
                {isBaseline
                  ? <Badge variant="outline" className="text-[10px] shrink-0 bg-slate-50 text-slate-500 border-slate-200">Baseline</Badge>
                  : <button type="button" onClick={() => removeScenario(def.id)} className="text-slate-300 hover:text-red-500 shrink-0"><X className="h-4 w-4" /></button>}
              </div>

              <CardContent className="px-4 py-4 space-y-4">
                {/* Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => {
                    const activePreset = p.stages.length === def.wonStages.length && p.stages.every((s) => def.wonStages.includes(s));
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => applyPreset(def.id, p.stages)}
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all",
                          activePreset ? "bg-primary text-white border-primary" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
                        )}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>

                {/* Stage toggles */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Assume these deals win</p>
                  <div className="flex flex-col gap-1">
                    {STAGES.map((st) => {
                      const on = def.wonStages.includes(st.key);
                      return (
                        <button
                          key={st.key}
                          type="button"
                          onClick={() => toggleStage(def.id, st.key)}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-all border",
                            on ? "bg-indigo-50/60 border-indigo-100 text-slate-800" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200",
                          )}
                        >
                          <span className={cn("h-3.5 w-3.5 rounded flex items-center justify-center shrink-0 border", on ? "bg-primary border-primary" : "border-slate-300")}>
                            {on && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                          </span>
                          <span className="font-medium">{st.label}</span>
                          <span className="text-[10px] text-slate-400 ml-auto">{st.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Horizon */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Horizon</span>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                    {HORIZONS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => updateDef(def.id, { horizonMonths: h })}
                        className={cn("px-2.5 py-1 text-[11px] font-medium rounded-md", def.horizonMonths === h ? "bg-white text-slate-800 shadow-sm" : "text-slate-500")}
                      >
                        {h}mo
                      </button>
                    ))}
                  </div>
                </div>

                {/* Metrics */}
                {f ? (
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1"><Users className="h-3.5 w-3.5" />Hires needed</span>
                        {!isBaseline && hireDelta !== 0 && (
                          <span className={cn("text-[11px] font-bold", hireDelta > 0 ? "text-amber-600" : "text-emerald-600")}>{hireDelta > 0 ? `+${hireDelta}` : `${hireDelta}`}</span>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-slate-900 leading-tight">{f.totalHireCount}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-3 text-xs">
                      <Metric
                        icon={TrendingDown}
                        label="Shortfall"
                        value={`${f.totalShortfallFTE} FTE`}
                        valueClass={f.totalShortfallFTE > 0 ? "text-red-700" : "text-emerald-700"}
                        delta={!isBaseline && shortDelta !== 0 ? (shortDelta > 0 ? `+${shortDelta}` : `${shortDelta}`) : undefined}
                        deltaClass={shortDelta > 0 ? "text-red-600" : "text-emerald-600"}
                      />
                      <Metric icon={Users} label="Bench" value={`${f.benchFTE} FTE`} valueClass="text-blue-700" />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-50">
                      <span className="text-slate-400">First gap</span>
                      <span className={cn("font-semibold", f.firstShortfallMonth ? "text-amber-700" : "text-emerald-700")}>
                        {f.firstShortfallMonth ? `${fmtMonth(f.firstShortfallMonth)}${f.hireByDate ? `, hire by ${fmtMonth(f.hireByDate)}` : ""}` : "no gap"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Attrition in horizon</span>
                      <span className="font-semibold text-slate-700">{f.attritionCount}</span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-400 italic">
                    Edited. Press Update comparison to recalculate.
                  </div>
                )}

                {idx === 0 && (
                  <p className="text-[10px] text-slate-400 leading-snug">This column is the baseline. Other scenarios show their difference against it.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Metric({
  icon: Icon, label, value, valueClass, delta, deltaClass,
}: {
  icon: React.ElementType; label: string; value: string; valueClass?: string; delta?: string; deltaClass?: string;
}) {
  return (
    <div>
      <span className="text-[10px] text-slate-400 flex items-center gap-1"><Icon className="h-3 w-3" />{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className={cn("text-sm font-bold", valueClass ?? "text-slate-800")}>{value}</span>
        {delta && <span className={cn("text-[10px] font-bold", deltaClass)}>{delta}</span>}
      </span>
    </div>
  );
}
