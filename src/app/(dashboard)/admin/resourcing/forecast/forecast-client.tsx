"use client";

import { useState, useTransition } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  Users, TrendingDown, CalendarClock, Radar,
} from "lucide-react";
import { getResourceForecastAction, narrateResourceForecastAction } from "@/server/actions/forecast";
import { DecisionCard } from "@/components/shared/decision-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  ResourceForecast, ForecastScenario, MonthlyForecastPoint,
} from "@/server/services/forecast.service";
import type { ExtensionSummary } from "@/server/services/extension-forecast.service";

const SCENARIOS: { value: ForecastScenario; label: string; hint: string }[] = [
  { value: "confirmed", label: "Confirmed", hint: "SOW-signed only" },
  { value: "weighted", label: "Weighted", hint: "signed + probability-weighted pipeline" },
  { value: "all", label: "All-in", hint: "signed + full unsigned pipeline" },
];
const HORIZONS = [3, 6, 12];

const ROLE_COLUMNS: { label: string; tip: string }[] = [
  { label: "Role", tip: "Canonical role, parsed from each pipeline request's resource request and matched against employee job titles." },
  { label: "Peak demand", tip: "The highest FTE demand for this role in any single month across the horizon - the tightest point, not an average." },
  { label: "Avg supply", tip: "Average free capacity (FTE) for this role per month, after subtracting active allocations, planned leave, attrition, and holding people whose engagements are likely to extend." },
  { label: "Shortfall", tip: "Peak demand minus supply for this role: how many FTE you are short at the tightest month. Blank means supply covers demand." },
  { label: "Hires", tip: "People to hire to close the peak shortfall, rounded up to whole heads." },
  { label: "Hire by", tip: "Start recruiting by this month to have the hire productive before the gap opens, allowing an 8-week hiring lead time." },
];

function KpiTile({
  label, value, sub, icon: Icon, valueClass,
}: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; valueClass?: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="px-5 pt-4 pb-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-slate-500" />
        </div>
        <div className="min-w-0">
          <p className={cn("text-2xl font-bold leading-none", valueClass ?? "text-slate-800")}>{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Segmented<T extends string | number>({
  options, value, onChange, render,
}: {
  options: T[]; value: T; onChange: (v: T) => void; render: (v: T) => string;
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt)}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
            value === opt ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700",
          )}
        >
          {render(opt)}
        </button>
      ))}
    </div>
  );
}

export function ForecastClient({ initial, initialNarrative, extension }: { initial: ResourceForecast; initialNarrative: string; extension: ExtensionSummary | null }) {
  const [data, setData] = useState<ResourceForecast>(initial);
  const [narrative, setNarrative] = useState<string>(initialNarrative);
  const [scenario, setScenario] = useState<ForecastScenario>(initial.scenario);
  const [horizon, setHorizon] = useState<number>(initial.horizonMonths);
  const [pending, startTransition] = useTransition();
  const [narrating, startNarrate] = useTransition();

  function run(override: Partial<{ scenario: ForecastScenario; horizonMonths: number }> = {}) {
    const params = { horizonMonths: horizon, scenario, ...override };
    startTransition(async () => {
      const res = await getResourceForecastAction(params);
      setData(res);
    });
    startNarrate(async () => {
      try {
        const text = await narrateResourceForecastAction(params);
        if (text) setNarrative(text);
      } catch {
        /* keep previous narrative on failure */
      }
    });
  }

  const hasShortfall = data.totalShortfallFTE > 0;
  const decisionVariant = hasShortfall
    ? (data.firstShortfallMonth ? "NO" : "YES_WITH_CONDITIONS")
    : "YES";

  const chartData = data.monthly;

  return (
    <div className="space-y-5">
      {/* ── Controls ── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="px-5 py-4 flex flex-wrap items-start gap-x-8 gap-y-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Pipeline scenario</p>
            <Segmented
              options={SCENARIOS.map((s) => s.value)}
              value={scenario}
              onChange={(v) => { setScenario(v); run({ scenario: v }); }}
              render={(v) => SCENARIOS.find((s) => s.value === v)?.label ?? v}
            />
            <p className="text-[11px] text-muted-foreground">
              {SCENARIOS.find((s) => s.value === scenario)?.hint}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Horizon</p>
            <Segmented
              options={HORIZONS}
              value={horizon}
              onChange={(v) => { setHorizon(v); run({ horizonMonths: v }); }}
              render={(v) => `${v} mo`}
            />
          </div>

          {pending && <span className="text-xs text-muted-foreground animate-pulse ml-auto">Recalculating…</span>}
        </CardContent>
      </Card>

      {/* ── Results (with loading overlay) ── */}
      <div className="relative">
        {pending && (
          <div className="absolute inset-0 z-20 flex items-start justify-center pt-24 rounded-xl bg-white/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full bg-white shadow-md border border-slate-200 px-4 py-2">
              <span className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <span className="text-xs font-medium text-slate-600">Updating forecast…</span>
            </div>
          </div>
        )}
        <div className={cn("space-y-5 transition-opacity duration-200", pending ? "opacity-40 pointer-events-none" : "")}>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KpiTile
          icon={TrendingDown}
          label="Resource shortfall"
          value={`${data.totalShortfallFTE} FTE`}
          sub={`${data.totalHireCount} hire${data.totalHireCount !== 1 ? "s" : ""} to close`}
          valueClass={hasShortfall ? "text-red-700" : "text-green-700"}
        />
        <KpiTile
          icon={Users}
          label="Bench capacity"
          value={`${data.benchFTE} FTE`}
          sub={`${data.attritionCount} leaving · ${data.overAllocCount} over-allocated`}
          valueClass={data.benchFTE > 0 ? "text-blue-700" : "text-slate-800"}
        />
      </div>

      {/* ── Demand vs Supply chart ── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-5 py-3 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Demand vs Supply over {horizon} months</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Bars = demand (confirmed + probable). Green line = supply. Blue line = net capacity (surplus above 0, shortfall below). Hover any month for the read-out.
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-3 py-4">
          {chartData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              No pipeline demand loaded. Run the ETL to ingest pipeline requests.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                <defs>
                  <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="fte" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false}
                  label={{ value: "FTE", angle: -90, position: "insideLeft", fill: "#94A3B8", fontSize: 11, dy: 20 }} />
                <ReferenceLine yAxisId="fte" y={0} stroke="#cbd5e1" strokeWidth={1} />
                <Tooltip content={<ForecastTooltip />} cursor={{ fill: "rgba(99,102,241,0.05)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Bar yAxisId="fte" dataKey="confirmedDemandFTE" name="Confirmed demand" stackId="d" fill="url(#confGrad)" radius={[0, 0, 0, 0]} maxBarSize={44} />
                <Bar yAxisId="fte" dataKey="probableDemandFTE" name="Probable demand" stackId="d" fill="#C7D2FE" radius={[4, 4, 0, 0]} maxBarSize={44} />
                <Line yAxisId="fte" type="monotone" dataKey="supplyFTE" name="Supply" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: "#10B981" }} activeDot={{ r: 5 }} />
                <Line yAxisId="fte" type="monotone" dataKey="gapFTE" name="Net capacity" stroke="#0EA5E9" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2.5, fill: "#0EA5E9" }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Decision ── */}
      <DecisionCard
        headline={
          hasShortfall
            ? data.firstShortfallMonth
              ? `Short ${data.totalHireCount} resource${data.totalHireCount !== 1 ? "s" : ""} from ${fmtMonth(data.firstShortfallMonth)}, demand exceeds supply`
              : `Tight capacity: ${data.totalShortfallFTE} FTE gap across the horizon`
            : "Supply covers projected demand across the horizon"
        }
        decisionVariant={decisionVariant}
        action={
          hasShortfall
            ? data.hireByDate
              ? `Start hiring by ${fmtMonth(data.hireByDate)} (8-week lead time). Prioritise the roles below. ${data.benchFTE > 0 ? `Redeploy ${data.benchFTE} FTE from bench first.` : ""}`
              : "Rebalance from bench / ramp-down projects before hiring."
            : `Monitor the pipeline. ${data.benchFTE > 0 ? `${data.benchFTE} FTE on bench is billable headroom, deploy it or it leaks cost.` : "Capacity is well matched."}`
        }
        evidence={[
          `${data.totalShortfallFTE} FTE shortfall · ${data.totalHireCount} hires to fully close`,
          `${data.byRole.filter((r) => r.shortfallFTE > 0).length} role${data.byRole.filter((r) => r.shortfallFTE > 0).length !== 1 ? "s" : ""} short${data.firstShortfallMonth ? ` · first gap ${fmtMonth(data.firstShortfallMonth)}` : ""}`,
          `Scenario: ${SCENARIOS.find((s) => s.value === scenario)?.label} · ${data.benchFTE} FTE bench · ${data.attritionCount} attrition · Data coverage ${data.dataCoverage}%`,
        ]}
        aiWhy={narrating ? "Generating executive read…" : (narrative || undefined)}
        confidence={data.dataCoverage >= 80 ? "HIGH" : data.dataCoverage >= 50 ? "MEDIUM" : "LOW"}
      />

      {/* ── Extension Radar signal (feeds the supply projection) ── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-5 py-3 border-b flex flex-row items-start gap-2">
          <Radar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <CardTitle className="text-sm font-semibold">Extension Radar signal</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Renewal likelihood of current engagements. People on likely-to-extend work are held in the supply above (they will not roll off on schedule); unlikely-to-extend work frees capacity.
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-4">
          {!extension || extension.totalEntries === 0 ? (
            <p className="text-xs text-muted-foreground">No extension radar data loaded.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { k: "VERY_LIKELY", label: "Definitely extend", cls: "text-emerald-700" },
                  { k: "LIKELY", label: "Likely extend", cls: "text-blue-700" },
                  { k: "UNCERTAIN", label: "Uncertain", cls: "text-amber-700" },
                  { k: "UNLIKELY", label: "Won't extend", cls: "text-red-700" },
                  { k: "UNKNOWN", label: "Unknown", cls: "text-slate-500" },
                ].map((b) => (
                  <div key={b.k} className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                    <p className={cn("text-xl font-bold leading-none", b.cls)}>
                      {extension.byBand[b.k as keyof typeof extension.byBand] ?? 0}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">{b.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                {extension.byBand.VERY_LIKELY + extension.byBand.LIKELY} of {extension.totalEntries} engagement{extension.totalEntries !== 1 ? "s" : ""} are likely to extend and are held in the supply projection above.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Shortfall by role ── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-5 py-3 border-b flex flex-row items-center gap-2">
          <CalendarClock className="w-4 h-4 text-slate-400" />
          <CardTitle className="text-sm font-semibold">Shortfall by Role & Hire-by Date</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <TooltipProvider delay={100}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/60">
                {ROLE_COLUMNS.map((c) => (
                  <th key={c.label} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    <UITooltip>
                      <TooltipTrigger className="cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2">
                        {c.label}
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[250px] text-xs font-normal normal-case tracking-normal leading-snug">
                        {c.tip}
                      </TooltipContent>
                    </UITooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.byRole.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">No role demand in this scenario.</td></tr>
              ) : data.byRole.map((r) => (
                <tr key={r.role} className="border-b last:border-0 hover:bg-slate-50/40">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{r.role}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.peakDemandFTE}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.supplyFTE}</td>
                  <td className={cn("px-4 py-2.5 font-semibold", r.shortfallFTE > 0 ? "text-red-700" : "text-green-700")}>
                    {r.shortfallFTE > 0 ? r.shortfallFTE : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.hireCount > 0 ? r.hireCount : "-"}</td>
                  <td className={cn("px-4 py-2.5", r.hireByDate ? "text-amber-700 font-medium" : "text-slate-400")}>
                    {r.hireByDate ? fmtMonth(r.hireByDate) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TooltipProvider>
        </div>
      </Card>
        </div>
      </div>
    </div>
  );
}

function TooltipRow({ color, label, value, valueClass }: { color: string; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-slate-500">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
        {label}
      </span>
      <span className={cn("font-semibold", valueClass ?? "text-slate-800")}>{value}</span>
    </div>
  );
}

interface ForecastTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MonthlyForecastPoint }>;
}

function ForecastTooltip({ active, payload }: ForecastTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]!.payload;
  const shortfall = Math.max(0, Math.round((p.demandFTE - p.supplyFTE) * 10) / 10);
  const surplus = Math.max(0, Math.round((p.supplyFTE - p.demandFTE) * 10) / 10);
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-lg px-3.5 py-3 text-xs min-w-[236px]">
      <p className="font-semibold text-slate-800 mb-2 text-[13px]">{p.label}</p>
      <div className="space-y-1.5">
        <TooltipRow color="#6366F1" label="Total demand" value={`${p.demandFTE} FTE`} />
        <div className="pl-3.5 space-y-1 text-[11px] text-slate-400">
          <div className="flex justify-between"><span>Confirmed (signed)</span><span className="font-medium text-slate-600">{p.confirmedDemandFTE} FTE</span></div>
          <div className="flex justify-between"><span>Probable (pipeline)</span><span className="font-medium text-slate-600">{p.probableDemandFTE} FTE</span></div>
        </div>
        <TooltipRow color="#10B981" label="Supply available" value={`${p.supplyFTE} FTE`} />
        <TooltipRow
          color="#0EA5E9"
          label="Net capacity"
          value={`${p.gapFTE > 0 ? "+" : ""}${p.gapFTE} FTE`}
          valueClass={p.gapFTE < 0 ? "text-red-600" : "text-emerald-600"}
        />
      </div>
      <div className={cn("mt-2.5 pt-2 border-t text-[11px] font-semibold leading-snug",
        shortfall > 0 ? "text-red-600 border-red-100" : "text-emerald-600 border-emerald-100")}>
        {shortfall > 0
          ? `Short ${shortfall} FTE this month. Hire or redeploy to cover it.`
          : `${surplus} FTE spare capacity, room to absorb more pipeline.`}
      </div>
    </div>
  );
}

function fmtMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
