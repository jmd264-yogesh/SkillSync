"use client";

import { useState, useTransition } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Users, TrendingDown, Banknote, AlertTriangle, Percent, CalendarClock, Target,
} from "lucide-react";
import { getResourceForecastAction, narrateResourceForecastAction } from "@/server/actions/forecast";
import { DecisionCard } from "@/components/shared/decision-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  ResourceForecast, ForecastScenario,
} from "@/server/services/forecast.service";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency", currency: "GBP", maximumFractionDigits: 0,
});
function money(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return gbp.format(n);
}

const SCENARIOS: { value: ForecastScenario; label: string; hint: string }[] = [
  { value: "confirmed", label: "Confirmed", hint: "SOW-signed only" },
  { value: "weighted", label: "Weighted", hint: "signed + probability-weighted pipeline" },
  { value: "all", label: "All-in", hint: "signed + full unsigned pipeline" },
];
const HORIZONS = [3, 6, 12];

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

export function ForecastClient({ initial, initialNarrative }: { initial: ResourceForecast; initialNarrative: string }) {
  const [data, setData] = useState<ResourceForecast>(initial);
  const [narrative, setNarrative] = useState<string>(initialNarrative);
  const [scenario, setScenario] = useState<ForecastScenario>(initial.scenario);
  const [horizon, setHorizon] = useState<number>(initial.horizonMonths);
  const [target, setTarget] = useState<string>("");
  const [period, setPeriod] = useState<"monthly" | "annual">("annual");
  const [pending, startTransition] = useTransition();
  const [narrating, startNarrate] = useTransition();

  function run(override: Partial<{ scenario: ForecastScenario; horizonMonths: number; revenueTarget: number | undefined; targetPeriod: "monthly" | "annual" }> = {}) {
    const targetNum = target.trim() ? Number(target.replace(/[^0-9.]/g, "")) : undefined;
    const params = {
      horizonMonths: horizon,
      scenario,
      revenueTarget: Number.isFinite(targetNum) ? targetNum : undefined,
      targetPeriod: period,
      ...override,
    };
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

  const rt = data.revenueTarget;

  return (
    <div className="space-y-5">
      {/* ── Controls ── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="px-5 py-4 flex flex-wrap items-end gap-x-8 gap-y-4">
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

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Revenue target</p>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") run(); }}
                  placeholder="e.g. 5,000,000"
                  inputMode="numeric"
                  className="w-40 pl-6 h-9 text-sm"
                />
              </div>
              <Segmented
                options={["annual", "monthly"] as const}
                value={period}
                onChange={(v) => { setPeriod(v); if (target.trim()) run({ targetPeriod: v }); }}
                render={(v) => v === "annual" ? "Annual" : "Monthly"}
              />
              <button
                type="button"
                onClick={() => run()}
                className="h-9 px-4 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Solve
              </button>
            </div>
          </div>

          {pending && <span className="text-xs text-muted-foreground animate-pulse ml-auto">Recalculating…</span>}
        </CardContent>
      </Card>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiTile
          icon={TrendingDown}
          label="Resource shortfall"
          value={`${data.totalShortfallFTE} FTE`}
          sub={`${data.totalHireCount} hire${data.totalHireCount !== 1 ? "s" : ""} to close`}
          valueClass={hasShortfall ? "text-red-700" : "text-green-700"}
        />
        <KpiTile
          icon={Banknote}
          label="Projected revenue"
          value={money(data.projectedAnnualRevenue)}
          sub="annualised, at target utilisation"
          valueClass="text-slate-800"
        />
        <KpiTile
          icon={AlertTriangle}
          label="Revenue at risk"
          value={money(data.revenueAtRiskAnnual)}
          sub="unstaffable demand, annualised"
          valueClass={data.revenueAtRiskAnnual > 0 ? "text-amber-700" : "text-slate-800"}
        />
        <KpiTile
          icon={Percent}
          label="Gross margin"
          value={`${data.projectedMarginPct}%`}
          sub={`cost ${money(data.projectedAnnualCost)}/yr`}
          valueClass={data.projectedMarginPct >= 40 ? "text-green-700" : data.projectedMarginPct >= 20 ? "text-amber-700" : "text-red-700"}
        />
        <KpiTile
          icon={Users}
          label="Bench capacity"
          value={`${data.benchFTE} FTE`}
          sub={`${data.attritionCount} leaving · ${data.overAllocCount} over-allocated`}
          valueClass={data.benchFTE > 0 ? "text-blue-700" : "text-slate-800"}
        />
      </div>

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
          `Projected revenue ${money(data.projectedAnnualRevenue)}/yr at ${data.projectedMarginPct}% margin`,
          `${money(data.revenueAtRiskAnnual)}/yr at risk from demand you can't staff`,
          `Scenario: ${SCENARIOS.find((s) => s.value === scenario)?.label} · ${data.benchFTE} FTE bench · ${data.attritionCount} attrition · Data coverage ${data.dataCoverage}%`,
        ]}
        aiWhy={narrating ? "Generating executive read…" : (narrative || undefined)}
        confidence={data.dataCoverage >= 80 ? "HIGH" : data.dataCoverage >= 50 ? "MEDIUM" : "LOW"}
      />

      {/* ── Demand vs Supply + Revenue chart ── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-5 py-3 border-b">
          <CardTitle className="text-sm font-semibold">Demand vs Supply & Revenue over {horizon} months</CardTitle>
        </CardHeader>
        <CardContent className="px-3 py-4">
          {data.monthly.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              No pipeline demand loaded. Run the ETL to ingest pipeline requests.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data.monthly} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="fte" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false}
                  label={{ value: "FTE", angle: -90, position: "insideLeft", fill: "#94A3B8", fontSize: 11, dy: 20 }} />
                <YAxis yAxisId="rev" orientation="right" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => money(v)} />
                <Tooltip
                  formatter={(value, name) => {
                    const num = typeof value === "number" ? value : Number(value);
                    return String(name).includes("Revenue") ? money(num) : `${num} FTE`;
                  }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="fte" dataKey="confirmedDemandFTE" name="Confirmed demand" stackId="d" fill="#6366F1" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="fte" dataKey="probableDemandFTE" name="Probable demand" stackId="d" fill="#C7D2FE" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="fte" dataKey="supplyFTE" name="Supply (FTE)" fill="#34D399" radius={[3, 3, 0, 0]} />
                <Line yAxisId="rev" type="monotone" dataKey="projectedRevenue" name="Projected Revenue" stroke="#F59E0B" strokeWidth={2} dot={false} />
                <Line yAxisId="rev" type="monotone" dataKey="revenueAtRisk" name="Revenue at Risk" stroke="#EF4444" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Revenue target solver ── */}
      {rt && (
        <Card className="border shadow-sm overflow-hidden">
          <div className={cn(
            "px-5 py-3 border-b flex items-center justify-between gap-3",
            rt.achievable ? "bg-green-50 border-green-200" : rt.coverableFromBench ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200",
          )}>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-semibold text-slate-800">
                To hit {money(rt.target)} {rt.period} revenue
              </p>
            </div>
            <Badge variant="outline" className={cn(
              "text-xs font-medium",
              rt.achievable ? "bg-green-100 text-green-800 border-green-300"
                : rt.coverableFromBench ? "bg-amber-100 text-amber-800 border-amber-300"
                : "bg-red-100 text-red-800 border-red-300",
            )}>
              {rt.achievable ? "Achievable now" : rt.coverableFromBench ? "Redeploy bench" : "Hiring required"}
            </Badge>
          </div>
          <CardContent className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SolveStat label="Required billable" value={`${rt.requiredBillableFTE} FTE`} />
              <SolveStat label="Currently billable" value={`${rt.currentBillableFTE} FTE`} />
              <SolveStat
                label="Additional needed"
                value={`${rt.additionalFTENeeded} FTE`}
                valueClass={rt.additionalFTENeeded > 0 ? "text-red-700" : "text-green-700"}
              />
              <SolveStat label="Blended day-rate basis" value={money(rt.avgBillRateMonthly / 21)} sub="per billable day" />
            </div>
            {rt.hiresByRole.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Suggested hires by role</p>
                <div className="flex flex-wrap gap-2">
                  {rt.hiresByRole.map((h) => (
                    <Badge key={h.role} variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-200">
                      {h.hireCount}× {h.role}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Assumes 80% target utilisation. Required FTE = monthly target ÷ (blended monthly bill-rate × utilisation).
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Shortfall by role ── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-5 py-3 border-b flex flex-row items-center gap-2">
          <CalendarClock className="w-4 h-4 text-slate-400" />
          <CardTitle className="text-sm font-semibold">Shortfall by Role & Hire-by Date</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/60">
                {["Role", "Peak demand", "Avg supply", "Shortfall", "Hires", "Hire by", "Rev. at risk /mo"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.byRole.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-muted-foreground">No role demand in this scenario.</td></tr>
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
                  <td className="px-4 py-2.5 text-slate-600">{r.revenueAtRiskMonthly > 0 ? money(r.revenueAtRiskMonthly) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SolveStat({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold", valueClass ?? "text-slate-800")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
    </div>
  );
}

function fmtMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
