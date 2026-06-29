"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  AreaChart,
  Area,
  Legend,
  ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, AlertTriangle, Briefcase, Lightbulb, Activity, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineRequestWithContext } from "@/server/services/pipeline.service";
import { SectionCard, KpiCard } from "../../../analytics/analytics-client";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const PRIMARY = "#19105b"; // Deep Navy
const SECONDARY = "#ff6196"; // Vibrant Pink

const STAGE_CONFIG = [
  { key: "LEAD",        label: "Opportunity Inception",  shortLabel: "Inception", confidence: 20,  color: "#cbd5e1" },
  { key: "PROPOSAL",   label: "Make It Real",            shortLabel: "Proposal",  confidence: 20,  color: "#a5b4fc" },
  { key: "SOW_PENDING",label: "Build Proposition",       shortLabel: "Build",     confidence: 40,  color: "#ff8da1" },
  { key: "SOW_SIGNED", label: "SOW Signed",              shortLabel: "Signed",    confidence: 80,  color: SECONDARY },
  { key: "ACTIVE",     label: "Active Delivery",         shortLabel: "Active",    confidence: 100, color: PRIMARY },
  { key: "RAMP_DOWN",  label: "Extension / Ramp Down",   shortLabel: "Ext/RD",    confidence: 100, color: "#6366f1" },
] as const;

function normalizeStage(raw: string | null): string {
  if (!raw) return "UNKNOWN";
  return raw.toUpperCase().replace(/\s+/g, "_");
}

type WaterfallDatum = {
  stage: string;
  base: number;
  value: number;
  total: number;
  deals: number;
  fill: string;
};

// ─── Custom Tooltip ────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label, suffix = "FTEs" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-900 p-3 shadow-xl text-white text-xs space-y-1.5 backdrop-blur-md">
        <p className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-3 justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.stroke || p.fill }} />
              {p.name}:
            </span>
            <span className="font-extrabold text-slate-50">{p.value} {suffix}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Main component ────────────────────────────────────────────

export function PipelineAnalyticsClient({
  requests,
  benchCount = 0,
}: {
  requests: PipelineRequestWithContext[];
  benchCount?: number;
}) {
  const active = useMemo(
    () => requests.filter((r) => !r.dealLostAt),
    [requests],
  );

  // ── KPIs ──

  const kpis = useMemo(() => {
    const grossFTEs = active.reduce((s, r) => s + (r.resourceRecommended ?? 0), 0);
    const weightedFTEs = active.reduce(
      (s, r) => s + (r.resourceRecommended ?? 0) * (r.confidence / 100),
      0,
    );
    const resolvedStartDates = active.filter(r => r.likelyStart).length;
    const avgDuration = active.filter(r => r.numberOfWeeks).reduce((s, r) => s + (r.numberOfWeeks ?? 0), 0) / (active.filter(r => r.numberOfWeeks).length || 1);

    return {
      totalDeals: active.length,
      grossFTEs: Math.round(grossFTEs * 10) / 10,
      weightedFTEs: Math.round(weightedFTEs * 10) / 10,
      atRisk: active.filter((r) => r.hiringLeadTimeAlert && r.dealStage?.toUpperCase() !== "ACTIVE" && r.dealStage?.toUpperCase() !== "RAMP_DOWN").length,
      resolvedStartDates,
      avgDuration: Math.round(avgDuration * 10) / 10,
    };
  }, [active]);

  // ── Dynamic Executive Brief ──

  const executiveBrief = useMemo(() => {
    const slCounts = new Map<string, number>();
    active.forEach(r => {
      if (r.serviceLine && r.resourceRecommended) {
        slCounts.set(r.serviceLine, (slCounts.get(r.serviceLine) || 0) + r.resourceRecommended);
      }
    });
    const sortedSl = Array.from(slCounts.entries()).sort((a, b) => b[1] - a[1]);
    const topServiceLine = sortedSl[0]?.[0] || "Value Creation";
    const topServiceLineFte = sortedSl[0]?.[1] || 0;

    const conversionRate = kpis.grossFTEs > 0 ? (kpis.weightedFTEs / kpis.grossFTEs * 100).toFixed(0) : "0";

    const text = `The active pipeline contains ${kpis.totalDeals} opportunities representing ${kpis.grossFTEs.toFixed(1)} Gross FTE demand. With probability weighting, the confidence-adjusted demand is ${kpis.weightedFTEs.toFixed(1)} FTEs (representing a ${conversionRate}% expected conversion rate). The primary service line driver is ${topServiceLine} (${topServiceLineFte.toFixed(1)} Gross FTEs). Currently, ${kpis.atRisk} opportunities require urgent hiring action due to start dates falling within 6 months without allocated bench resources.`;

    return {
      text,
      topServiceLine,
      conversionRate
    };
  }, [active, kpis]);

  // ── Funnel (deal count + FTE per stage) ──

  const funnelData = useMemo(
    () =>
      STAGE_CONFIG.map((cfg) => {
        const deals = active.filter((r) => normalizeStage(r.dealStage) === cfg.key);
        return {
          name: cfg.label,
          value: deals.length,
          fte: deals.reduce((s, r) => s + (r.resourceRecommended ?? 0), 0),
          confidence: cfg.confidence,
          fill: cfg.color,
        };
      }).filter((d) => d.value > 0),
    [active],
  );

  const maxFunnelVal = Math.max(...funnelData.map((d) => d.value), 1);

  // ── Waterfall (confidence-weighted FTE build-up) ──

  const waterfallData = useMemo((): WaterfallDatum[] => {
    let running = 0;
    const bars: WaterfallDatum[] = [];
    for (const cfg of STAGE_CONFIG) {
      const deals = active.filter((r) => normalizeStage(r.dealStage) === cfg.key);
      if (deals.length === 0) continue;
      const raw = deals.reduce((s, r) => s + (r.resourceRecommended ?? 0), 0);
      const weighted = Math.round((raw * cfg.confidence) / 100 * 10) / 10;
      const base = Math.round(running * 10) / 10;
      running = Math.round((running + weighted) * 10) / 10;
      bars.push({ stage: cfg.shortLabel, base, value: weighted, total: running, deals: deals.length, fill: cfg.color });
    }
    bars.push({ stage: "Total", base: 0, value: running, total: running, deals: active.length, fill: PRIMARY });
    return bars;
  }, [active]);


  // ── Start date timeline (monthly) ──

  const timelineData = useMemo(() => {
    const byMonth = new Map<string, { month: string; rawFTE: number; weightedFTE: number; deals: number }>();
    active
      .filter((r) => r.likelyStart !== null)
      .forEach((r) => {
        if (!r.likelyStart) return;
        const d = new Date(r.likelyStart);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const month = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        const prev = byMonth.get(key) ?? { month, rawFTE: 0, weightedFTE: 0, deals: 0 };
        byMonth.set(key, {
          month,
          rawFTE: Math.round((prev.rawFTE + (r.resourceRecommended ?? 0)) * 10) / 10,
          weightedFTE: Math.round(
            (prev.weightedFTE + (r.resourceRecommended ?? 0) * (r.confidence / 100)) * 10,
          ) / 10,
          deals: prev.deals + 1,
        });
      });
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [active]);


  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Executive Brief Banner ── */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/30 to-slate-50/50 border border-indigo-100/50 p-6 rounded-2xl flex items-start gap-4 shadow-sm relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 h-32 w-32 bg-indigo-200/20 rounded-full blur-2xl translate-x-12 translate-y-[-12px]" />
        <div className="absolute bottom-0 right-1/4 h-24 w-24 bg-purple-200/20 rounded-full blur-2xl translate-y-12" />
        <div className="h-10 w-10 bg-indigo-900 rounded-xl flex items-center justify-center shrink-0 shadow-md border border-indigo-950">
          <Lightbulb className="h-5 w-5 text-white" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            Executive Brief & Capacity Supply Gap
          </h3>
          <p className="text-xs text-slate-700 leading-relaxed max-w-5xl font-medium">
            {executiveBrief.text}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">Conversion Index:</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold text-indigo-950 bg-indigo-50 border-indigo-200/50">
                {executiveBrief.conversionRate}% weighted
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">Active Supply Pool:</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold text-[#ff6196] bg-rose-50 border-[#ff6196]/20">
                {benchCount} Available Bench
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Pipeline Deals"
          value={kpis.totalDeals}
          sub={`Avg. duration: ${kpis.avgDuration} weeks`}
          icon={<Briefcase className="h-5 w-5 text-indigo-950" />}
          accent="bg-slate-50 text-indigo-950 border-slate-100"
        />
        <KpiCard
          label="Gross Headcount Demand"
          value={`${kpis.grossFTEs} FTE`}
          sub="Total raw resource request"
          icon={<Users className="h-5 w-5 text-[#ff6196]" />}
          accent="bg-rose-50/50 text-[#ff6196] border-[#ff6196]/10"
        />
        <KpiCard
          label="Weighted Expected Demand"
          value={`${kpis.weightedFTEs} FTE`}
          sub="Expected probability-adjusted load"
          icon={<TrendingUp className="h-5 w-5 text-indigo-950" />}
          accent="bg-indigo-50/50 text-indigo-950 border-indigo-100/50"
        />
        <KpiCard
          label="Urgent Hiring Risk"
          value={kpis.atRisk}
          sub="Start &lt; 6 months out"
          icon={<AlertTriangle className="h-5 w-5 text-rose-600" />}
          accent="bg-rose-50/50 text-rose-650 border-rose-150"
        />
      </div>

      {/* ── Funnel + Waterfall ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Pipeline Funnel — custom layout */}
        <SectionCard
          title="Pipeline Funnel"
          description="Opportunities and capacity load by HubSpot stage"
          className="lg:col-span-2"
          action={<Activity className="h-4 w-4 text-slate-400" />}
        >
          {funnelData.length > 0 ? (
            <div className="space-y-4 pt-2">
              {funnelData.map((d, i) => {
                const pct = Math.round((d.value / maxFunnelVal) * 100);
                return (
                  <div key={i} className="group">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: d.fill }}
                        />
                        <span className="text-xs font-bold text-slate-700 truncate">{d.name}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 h-4 shrink-0 font-bold cursor-help"
                                style={{ borderColor: d.fill, color: d.fill === PRIMARY ? "#ffffff" : d.fill, backgroundColor: d.fill === PRIMARY ? PRIMARY : `${d.fill}15` }}
                              >
                                {d.confidence}% win
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                              Expected probability of converting this stage to a confirmed project. {d.confidence}% of gross FTE demand at this stage is expected to become real demand.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <span className="text-xs text-slate-500 font-semibold shrink-0 ml-2">
                        {d.value} deals · <span className="text-slate-700 font-bold">{d.fte.toFixed(1)} FTE</span>
                      </span>
                    </div>
                    <div className="w-full h-8 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 p-0.5">
                      <div
                        className="h-full rounded-md flex items-center justify-end pr-2.5 transition-all duration-500 relative group-hover:brightness-105"
                        style={{ width: `${pct}%`, backgroundColor: d.fill }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10 rounded-md" />
                        {pct >= 22 && (
                          <span className="text-[10px] font-black text-white drop-shadow-sm select-none z-10">{pct}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10 font-medium">
              No active pipeline data available.
            </p>
          )}
        </SectionCard>

        {/* Headcount Waterfall */}
        <SectionCard
          title="Headcount Cumulative Build"
          description="Confidence-weighted FTE build-up per stage — cumulative waterfall"
          className="lg:col-span-3"
          action={<Scale className="h-4 w-4 text-slate-400" />}
        >
          <div className="pt-2">
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={waterfallData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 10, fill: "#64748b", fontWeight: "semibold" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b", fontWeight: "semibold" }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                {/* transparent base lifts each colored bar to its starting position */}
                <Bar dataKey="base" stackId="wf" fill="transparent" stroke="none" />
                <Bar dataKey="value" stackId="wf" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 justify-center border-t border-slate-100 pt-3">
              {waterfallData.filter(d => d.stage !== "Total").map((d) => {
                const cfg = STAGE_CONFIG.find(c => c.shortLabel === d.stage);
                if (!cfg) return null;
                return (
                  <div key={d.stage} className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {cfg.shortLabel} ({cfg.confidence}%)
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIMARY }} />
                <span className="text-[10px] text-slate-800 font-bold">Total Expected</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Resource Demand & Bench Supply Capacity Timeline ── */}
      {timelineData.length > 0 && (
        <SectionCard
          title="Supply vs. Demand Timeline Forecast"
          description="FTE demand by start month compared against available bench resource capacity"
          action={<TrendingUp className="h-4 w-4 text-indigo-950" />}
        >
          <div className="pt-2">
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="gradRaw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SECONDARY} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={SECONDARY} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradWeighted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#64748b", fontWeight: "semibold" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b", fontWeight: "semibold" }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="rawFTE"
                  name="Gross FTE Demand"
                  stroke={SECONDARY}
                  strokeWidth={2}
                  fill="url(#gradRaw)"
                />
                <Area
                  type="monotone"
                  dataKey="weightedFTE"
                  name="Weighted Expected Demand"
                  stroke={PRIMARY}
                  strokeWidth={2.5}
                  fill="url(#gradWeighted)"
                />
                {benchCount > 0 && (
                  <ReferenceLine
                    y={benchCount}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{
                      value: `Bench Supply Capacity: ${benchCount} FTE`,
                      position: "top",
                      fill: "#ef4444",
                      fontSize: 10,
                      fontWeight: "bold",
                    }}
                  />
                )}
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10, fontWeight: "semibold" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {/* ── Stage Summary Table ── */}
      <SectionCard
        title="Pipeline Conversion Breakdown"
        description="Summary of Gross vs. Probability-Weighted headcount demand by stage"
      >
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-bold text-slate-400 pb-2 pr-4 uppercase tracking-wider">Pipeline Stage</th>
                <th className="text-right text-xs font-bold text-slate-400 pb-2 px-4 uppercase tracking-wider">Active Deals</th>
                <th className="text-right text-xs font-bold text-slate-400 pb-2 px-4 uppercase tracking-wider">Gross Demand (FTE)</th>
                <th className="text-right text-xs font-bold text-slate-400 pb-2 px-4 uppercase tracking-wider">Win Confidence</th>
                <th className="text-right text-xs font-bold text-slate-400 pb-2 pl-4 uppercase tracking-wider">Expected Demand (FTE)</th>
              </tr>
            </thead>
            <tbody>
              {STAGE_CONFIG.map((cfg) => {
                const deals = active.filter(
                  (r) => normalizeStage(r.dealStage) === cfg.key,
                );
                if (deals.length === 0) return null;
                const gross = deals.reduce((s, r) => s + (r.resourceRecommended ?? 0), 0);
                const weighted = Math.round((gross * cfg.confidence) / 100 * 10) / 10;
                return (
                  <tr key={cfg.key} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors font-medium text-slate-600">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: cfg.color }}
                        />
                        <span className="font-bold text-slate-800">{cfg.label}</span>
                      </div>
                    </td>
                    <td className="text-right px-4 font-bold text-slate-700">{deals.length}</td>
                    <td className="text-right px-4">{gross.toFixed(1)}</td>
                    <td className="text-right px-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-bold cursor-help"
                              style={{ borderColor: cfg.color, color: cfg.color === PRIMARY ? "#ffffff" : cfg.color, backgroundColor: cfg.color === PRIMARY ? PRIMARY : `${cfg.color}15` }}
                            >
                              {cfg.confidence}%
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs max-w-[200px]">
                            {cfg.confidence}% win confidence — expected probability of these deals converting to confirmed projects.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="text-right pl-4 font-extrabold text-slate-800">{weighted.toFixed(1)}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50/80 border-t border-slate-200">
                <td className="py-3 pr-4 font-extrabold text-slate-800">Total Pipeline</td>
                <td className="text-right px-4 font-black text-slate-900">{active.length}</td>
                <td className="text-right px-4 font-black text-slate-900">{kpis.grossFTEs.toFixed(1)}</td>
                <td className="text-right px-4" />
                <td className="text-right pl-4 font-black text-indigo-900">{kpis.weightedFTEs.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>    </div>
  );
}
