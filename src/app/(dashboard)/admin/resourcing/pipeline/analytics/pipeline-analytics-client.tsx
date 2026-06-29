"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Cell,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Users, AlertTriangle, Briefcase, Lightbulb,
  Activity, Scale, ArrowRight, Info, Award, RefreshCw, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineRequestWithContext } from "@/server/services/pipeline.service";
import { SectionCard, KpiCard } from "../../../analytics/analytics-client";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const PRIMARY = "#19105b";
const SECONDARY = "#ff6196";

const STAGE_CONFIG = [
  { key: "LEAD",        label: "Opportunity Inception",  shortLabel: "Inception", confidence: 20,  color: "#cbd5e1" },
  { key: "PROPOSAL",   label: "Make It Real",            shortLabel: "Proposal",  confidence: 20,  color: "#a5b4fc" },
  { key: "SOW_PENDING",label: "Build Proposition",       shortLabel: "Build",     confidence: 40,  color: "#ff8da1" },
  { key: "SOW_SIGNED", label: "SOW Signed",              shortLabel: "Signed",    confidence: 80,  color: SECONDARY },
  { key: "ACTIVE",     label: "Active Delivery",         shortLabel: "Active",    confidence: 100, color: PRIMARY },
  { key: "RAMP_DOWN",  label: "Extension / Ramp Down",   shortLabel: "Ext/RD",    confidence: 100, color: "#6366f1" },
] as const;

const STAGE_FLOW_CONFIG = [
  { key: "LEAD",        abbr: "OI",  label: "Opportunity Inception", align: "down", color: "#64748b", desc: "Early-stage leads identified in HubSpot. Raw interest and initial staffing scoping." },
  { key: "PROPOSAL",   abbr: "MIR", label: "Make It Real",          align: "up",   color: "#818cf8", desc: "Proposal submitted. Scopes finalized, matching initial skill requirements." },
  { key: "SOW_PENDING",abbr: "BP",  label: "Build Proposition",     align: "down", color: "#fb7185", desc: "SOW draft prepared and pending review. High probability of resource demand." },
  { key: "SOW_SIGNED", abbr: "SOW", label: "SOW Signed",            align: "up",   color: SECONDARY, desc: "Scoping approved and signed. Allocations ready to be locked into projects." },
  { key: "ACTIVE",     abbr: "ACT", label: "Active Delivery",       align: "down", color: PRIMARY,   desc: "Active delivery. FTEs on the field, utilizing core skills." },
  { key: "RAMP_DOWN",  abbr: "EXT", label: "Extension/Ramp Down",   align: "up",   color: "#6366f1", desc: "Project near completion. Assessing renewal extensions or bench release." },
] as const;

const STAGE_SKILLS: Record<string, string[]> = {
  LEAD:        ["Client Discovery", "Initial Scoping", "Commercial Strategy"],
  PROPOSAL:    ["Solution Architecture", "FTE Estimations", "Tech Stack Mapping"],
  SOW_PENDING: ["Contractual SOW", "Resource Matching", "Commercial Review"],
  SOW_SIGNED:  ["Pre-onboarding", "Resource Allocation", "Project Kickoff"],
  ACTIVE:      ["Active Delivery", "Focal Competencies", "SLA Monitoring"],
  RAMP_DOWN:   ["Transition Planning", "Resource Release", "Extension Scoping"],
};

function normalizeStage(raw: string | null): string {
  if (!raw) return "UNKNOWN";
  return raw.toUpperCase().replace(/\s+/g, "_");
}

function formatLeadTime(months: number | null, likelyStart: Date | null): string {
  const dateStr = likelyStart
    ? new Date(likelyStart).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const suffix = dateStr ? ` (${dateStr})` : "";
  if (months === null) return "Start date unknown";
  if (months <= 0) return `Overdue${suffix}`;
  const days = Math.round(months * 30.44);
  if (days < 14) return `~${days} day${days === 1 ? "" : "s"}${suffix}`;
  const weeks = Math.round(days / 7);
  if (months < 2) return `~${weeks} week${weeks === 1 ? "" : "s"}${suffix}`;
  return `~${months.toFixed(1)} months${suffix}`;
}

type WaterfallDatum = { stage: string; base: number; value: number; total: number; deals: number; fill: string; };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-900 p-3 shadow-xl text-white text-xs space-y-1.5">
      <p className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-3 justify-between">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.stroke || p.fill }} />{p.name}:
          </span>
          <span className="font-extrabold text-slate-50">{p.value} FTEs</span>
        </div>
      ))}
    </div>
  );
};

export function PipelineAnalyticsClient({ requests, benchCount = 0 }: { requests: PipelineRequestWithContext[]; benchCount?: number; }) {
  const active = useMemo(() => requests.filter((r) => !r.dealLostAt), [requests]);
  const [selectedStage, setSelectedStage] = useState<string>("LEAD");

  const kpis = useMemo(() => {
    const grossFTEs = active.reduce((s, r) => s + (r.resourceRecommended ?? 0), 0);
    const weightedFTEs = active.reduce((s, r) => s + (r.resourceRecommended ?? 0) * (r.confidence / 100), 0);
    const durationDeals = active.filter(r => r.numberOfWeeks);
    const avgDuration = durationDeals.reduce((s, r) => s + (r.numberOfWeeks ?? 0), 0) / (durationDeals.length || 1);
    return {
      totalDeals: active.length,
      grossFTEs: Math.round(grossFTEs * 10) / 10,
      weightedFTEs: Math.round(weightedFTEs * 10) / 10,
      atRisk: active.filter((r) => r.hiringLeadTimeAlert && r.dealStage?.toUpperCase() !== "ACTIVE" && r.dealStage?.toUpperCase() !== "RAMP_DOWN").length,
      avgDuration: Math.round(avgDuration * 10) / 10,
    };
  }, [active]);

  const executiveBrief = useMemo(() => {
    const slCounts = new Map<string, number>();
    active.forEach(r => { if (r.serviceLine && r.resourceRecommended) slCounts.set(r.serviceLine, (slCounts.get(r.serviceLine) || 0) + r.resourceRecommended); });
    const sorted = Array.from(slCounts.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted[0]?.[0] || "Value Creation";
    const topFte = sorted[0]?.[1] || 0;
    const cr = kpis.grossFTEs > 0 ? (kpis.weightedFTEs / kpis.grossFTEs * 100).toFixed(0) : "0";
    return `The active pipeline contains ${kpis.totalDeals} opportunities representing ${kpis.grossFTEs.toFixed(1)} Gross FTE demand. With probability weighting, the confidence-adjusted demand is ${kpis.weightedFTEs.toFixed(1)} FTEs (${cr}% expected conversion rate). Primary service line: ${top} (${topFte.toFixed(1)} FTEs). ${kpis.atRisk} opportunities require urgent hiring action — start dates within 6 months without allocated bench.`;
  }, [active, kpis]);

  const flowStats = useMemo(() => STAGE_FLOW_CONFIG.map((cfg) => {
    const deals = active.filter((r) => normalizeStage(r.dealStage) === cfg.key);
    const fte = deals.reduce((s, r) => s + (r.resourceRecommended ?? 0), 0);
    let winProb = 0.2;
    if (cfg.key === "SOW_PENDING") winProb = 0.4;
    else if (cfg.key === "SOW_SIGNED") winProb = 0.8;
    else if (cfg.key === "ACTIVE" || cfg.key === "RAMP_DOWN") winProb = 1.0;
    const atRiskDeals = (cfg.key === "ACTIVE" || cfg.key === "RAMP_DOWN") ? [] : deals.filter(r => r.hiringLeadTimeAlert);
    const dDeals = deals.filter(r => r.numberOfWeeks);
    const avgDuration = dDeals.reduce((s, r) => s + (r.numberOfWeeks ?? 0), 0) / (dDeals.length || 1);
    return { ...cfg, dealCount: deals.length, fte: Math.round(fte * 10) / 10, weightedFte: Math.round(fte * winProb * 10) / 10, hiringRisks: atRiskDeals.length, atRiskDeals, avgDuration: Math.round(avgDuration * 10) / 10 || 0, winProb: Math.round(winProb * 100) };
  }), [active]);

  const stageDetails = useMemo(() => flowStats.find((s) => s.key === selectedStage), [flowStats, selectedStage]);

  const funnelData = useMemo(() => STAGE_CONFIG.map((cfg) => {
    const deals = active.filter((r) => normalizeStage(r.dealStage) === cfg.key);
    const fte = deals.reduce((s, r) => s + (r.resourceRecommended ?? 0), 0);
    return { name: cfg.label, value: deals.length, fte, expectedFte: Math.round(fte * cfg.confidence / 100 * 10) / 10, confidence: cfg.confidence, fill: cfg.color };
  }).filter(d => d.value > 0), [active]);
  const maxFunnelVal = Math.max(Math.max(...funnelData.map(d => d.value), 1));

  const waterfallData = useMemo((): WaterfallDatum[] => {
    let running = 0;
    const bars: WaterfallDatum[] = [];
    for (const cfg of STAGE_CONFIG) {
      const deals = active.filter((r) => normalizeStage(r.dealStage) === cfg.key);
      if (!deals.length) continue;
      const raw = deals.reduce((s, r) => s + (r.resourceRecommended ?? 0), 0);
      const weighted = Math.round((raw * cfg.confidence) / 100 * 10) / 10;
      const base = Math.round(running * 10) / 10;
      running = Math.round((running + weighted) * 10) / 10;
      bars.push({ stage: cfg.shortLabel, base, value: weighted, total: running, deals: deals.length, fill: cfg.color });
    }
    bars.push({ stage: "Total", base: 0, value: running, total: running, deals: active.length, fill: PRIMARY });
    return bars;
  }, [active]);

  return (
    <div className="flex flex-col gap-6">

      {/* 1 — Executive Brief */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/30 to-slate-50/50 border border-indigo-100/50 p-6 rounded-2xl flex items-start gap-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 h-32 w-32 bg-indigo-200/20 rounded-full blur-2xl translate-x-12 -translate-y-3" />
        <div className="h-10 w-10 bg-indigo-900 rounded-xl flex items-center justify-center shrink-0 shadow-md">
          <Lightbulb className="h-5 w-5 text-white" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-indigo-950 uppercase tracking-wider text-[11px]">Executive Brief &amp; Capacity Supply Gap</h3>
          <p className="text-xs text-slate-700 leading-relaxed max-w-5xl font-medium">{executiveBrief}</p>
        </div>
      </div>

      {/* 2 — KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active Pipeline Deals" value={kpis.totalDeals} sub={`Avg. duration: ${kpis.avgDuration} weeks`} icon={<Briefcase className="h-5 w-5 text-indigo-950" />} accent="bg-slate-50 text-indigo-950 border-slate-100" />
        <KpiCard label="Gross Headcount Demand" value={`${kpis.grossFTEs} FTE`} sub="Total raw resource request" icon={<Users className="h-5 w-5 text-[#ff6196]" />} accent="bg-rose-50/50 text-[#ff6196] border-[#ff6196]/10" />
        <KpiCard label="Weighted Expected Demand" value={`${kpis.weightedFTEs} FTE`} sub="Probability-adjusted load" icon={<TrendingUp className="h-5 w-5 text-indigo-950" />} accent="bg-indigo-50/50 text-indigo-950 border-indigo-100/50" />
        <KpiCard label="Urgent Hiring Risk" value={kpis.atRisk} sub="Start < 6 months out" icon={<AlertTriangle className="h-5 w-5 text-rose-600" />} accent="bg-rose-50/50 text-rose-600 border-rose-200" />
      </div>

      {/* 3 — Flow Timeline */}
      <SectionCard title="Pipeline Flow & Funnel Timeline" description="Horizontal pipeline stages with branching demand metrics" action={<Activity className="h-4 w-4 text-slate-400" />} flush className="relative overflow-hidden">
        <div className="overflow-x-auto pb-4 pt-4 px-6 w-full">
          <div className="min-w-[920px] relative h-[420px]">
            <div className="w-[84%] h-6 bg-slate-100 rounded-full border border-slate-200/50 absolute left-[8%] top-[210px] -translate-y-1/2 shadow-inner overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-slate-400 via-indigo-500 to-[#ff6196] flex items-center justify-around px-10">
                {[...Array(6)].map((_, i) => <ChevronRight key={i} className="h-4 w-4 text-white/75 shrink-0" />)}
              </motion.div>
            </div>
            <div className="w-[84%] flex justify-between items-center absolute left-[8%] top-[210px] -translate-y-1/2 z-10">
              {flowStats.map((stage, idx) => {
                const isSelected = selectedStage === stage.key;
                const isUp = stage.align === "up";
                const stageColor = stage.key === "ACTIVE" ? { border: "border-emerald-500", ring: "ring-emerald-500/15", dot: "bg-emerald-500", line: "bg-emerald-300", card: "border-emerald-500 shadow-emerald-50", label: "text-emerald-800", prob: "text-emerald-600" }
                  : stage.key === "RAMP_DOWN" ? { border: "border-indigo-400", ring: "ring-indigo-400/15", dot: "bg-indigo-400", line: "bg-indigo-300", card: "border-indigo-400 shadow-indigo-50", label: "text-indigo-700", prob: "text-indigo-500" }
                  : stage.hiringRisks > 0 ? { border: "border-rose-500", ring: "ring-rose-500/15", dot: "bg-rose-500", line: "bg-rose-300", card: "border-rose-500 shadow-rose-50", label: "text-rose-800", prob: "text-rose-600" }
                  : { border: "border-[#ff6196]", ring: "ring-[#ff6196]/15", dot: "bg-[#ff6196]", line: "bg-slate-300", card: "border-[#ff6196] shadow-rose-50", label: "text-slate-850", prob: "text-slate-500" };
                return (
                  <div key={stage.key} className="relative flex flex-col items-center">
                    <motion.button whileHover={{ scale: 1.25 }} onClick={() => setSelectedStage(stage.key)}
                      className={cn("h-5 w-5 rounded-full border-2 bg-white flex items-center justify-center shadow-md relative z-20 outline-none transition-all",
                        isSelected ? `${stageColor.border} ring-4 ${stageColor.ring} scale-120` : stage.key === "ACTIVE" ? "border-emerald-400 bg-emerald-50" : stage.key === "RAMP_DOWN" ? "border-indigo-300 bg-indigo-50" : stage.hiringRisks > 0 ? "border-rose-300 bg-rose-50" : "border-slate-300"
                      )}>
                      <div className={cn("h-2 w-2 rounded-full", isSelected ? stageColor.dot : stage.key === "ACTIVE" ? "bg-emerald-400" : stage.key === "RAMP_DOWN" ? "bg-indigo-300" : stage.hiringRisks > 0 ? "bg-rose-500 animate-pulse" : "bg-slate-300")} />
                    </motion.button>
                    <div className={cn("absolute flex flex-col items-center", isUp ? "bottom-2.5" : "top-2.5")}>
                      <motion.div initial={{ height: 0 }} animate={{ height: 24 }} transition={{ delay: idx * 0.08, duration: 0.4 }} className={cn("w-0.5 relative", stageColor.line, isUp ? "flex flex-col-reverse" : "flex flex-col")}>
                        <div className={cn("w-3 h-0.5 absolute left-[-5px]", stageColor.line)} style={{ [isUp ? "top" : "bottom"]: 0 }} />
                      </motion.div>
                      <motion.div initial={{ opacity: 0, y: isUp ? -15 : 15 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.07, zIndex: 50 }}
                        transition={{ delay: idx * 0.1 + 0.15, duration: 0.3 }} onClick={() => setSelectedStage(stage.key)}
                        style={{ originX: "50%", originY: isUp ? "100%" : "0%" }}
                        className={cn("absolute w-40 rounded-xl border p-2.5 shadow-sm bg-white/95 cursor-pointer select-none", isUp ? "bottom-[24px]" : "top-[24px]",
                          isSelected ? `${stageColor.card} ring-2 ${stageColor.ring} shadow-md`
                            : stage.key === "ACTIVE" ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-400"
                            : stage.key === "RAMP_DOWN" ? "border-indigo-200 bg-indigo-50/30 hover:border-indigo-300"
                            : stage.hiringRisks > 0 ? "border-rose-300 bg-rose-50/50 hover:border-rose-400"
                            : "border-slate-200/80 hover:border-slate-300"
                        )}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-bold text-slate-400">{stage.key === "ACTIVE" ? "On Delivery" : stage.key === "RAMP_DOWN" ? "Post-Delivery" : "Probability"}</span>
                          <span className={cn("text-[9px] font-black", stageColor.prob)}>{stage.key === "ACTIVE" ? "LIVE ✓" : stage.key === "RAMP_DOWN" ? "EXT / ↓" : `${stage.winProb}% win`}</span>
                        </div>
                        <p className={cn("text-[11px] font-black tracking-tight leading-tight mt-1 mb-1", stageColor.label)}>{stage.label}</p>
                        {stage.hiringRisks > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="text-[9px] font-extrabold text-rose-600 bg-rose-50/80 border border-rose-100 rounded px-1.5 py-0.5 mt-1 mb-1 flex items-center gap-1 animate-pulse cursor-help w-fit">
                                  <AlertTriangle className="h-2.5 w-2.5 text-rose-500 shrink-0" />
                                  <span>{stage.hiringRisks} Resource Shortage{stage.hiringRisks > 1 ? "s" : ""}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="!flex-col !items-start !gap-1 max-w-[220px] whitespace-normal">
                                <p className="font-semibold text-[11px] border-b border-slate-700 pb-1 mb-0.5 w-full">Start &lt; 6mo — urgent hiring needed</p>
                                {stage.atRiskDeals.slice(0, 5).map((deal, di) => (
                                  <p key={di} className="text-[10px] leading-snug w-full">
                                    <span className="font-semibold text-slate-200">{deal.client ?? "Unknown"}</span>
                                    {deal.skillset ? <span className="text-slate-400"> · {deal.skillset}</span> : null}
                                    <span className="block text-rose-400 font-semibold text-[9px]">{formatLeadTime(deal.monthsUntilStart, deal.likelyStart)}</span>
                                  </p>
                                ))}
                                {stage.atRiskDeals.length > 5 && <p className="text-[10px] text-slate-400">+{stage.atRiskDeals.length - 5} more</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <div className="mt-2 pt-1.5 border-t border-slate-100 space-y-1 text-[9px] font-semibold text-slate-500">
                          <div className="flex justify-between"><span>Deals</span><span className="font-bold text-slate-700">{stage.dealCount}</span></div>
                          <div className="flex justify-between"><span>Gross FTE</span><span className="font-bold text-slate-700">{stage.fte.toFixed(1)}</span></div>
                          <div className="flex justify-between"><span>Expected Net</span><span className={cn("font-bold", stage.hiringRisks > 0 ? "text-rose-600" : "text-slate-700")}>{stage.weightedFte.toFixed(1)}</span></div>
                          <div className="flex justify-between"><span>Avg Duration</span><span className="font-bold text-slate-700">{stage.avgDuration} wks</span></div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 4 — Stage Details + Transition Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden lg:col-span-2">
          <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/20">
            <h3 className="font-bold text-sm text-slate-800 tracking-tight flex items-center gap-2"><Info className="h-4 w-4 text-slate-400" />Stage Analytics</h3>
            {stageDetails && <span className="text-[10px] font-bold text-slate-400 uppercase">{stageDetails.abbr} Phase</span>}
          </div>
          <div className="flex-1 px-6 pb-6 pt-5">
            <AnimatePresence mode="wait">
              {stageDetails && (
                <motion.div key={stageDetails.key} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }} className="space-y-5">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Stage</span>
                      <h4 className="font-black text-slate-950 text-lg leading-tight">{stageDetails.label}</h4>
                    </div>
                    <div className={cn("px-2.5 py-1 rounded-full border text-xs font-bold", stageDetails.key === "ACTIVE" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : stageDetails.key === "RAMP_DOWN" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-700")}>
                      {stageDetails.key === "ACTIVE" ? "Confirmed — Live" : stageDetails.key === "RAMP_DOWN" ? "Confirmed — Post-Delivery" : `${stageDetails.winProb}% Win Prob.`}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{stageDetails.desc}</p>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center"><span className="font-semibold flex items-center gap-1.5 text-slate-650"><Briefcase className="h-3.5 w-3.5 text-slate-400" />Avg Project Span</span><span className="font-bold text-slate-800">{stageDetails.avgDuration} weeks</span></div>
                    <div className="flex justify-between items-center"><span className="font-semibold flex items-center gap-1.5 text-slate-650"><AlertTriangle className="h-3.5 w-3.5 text-slate-400" />Hiring Alerts (&lt;6mo)</span><span className={cn("font-bold", stageDetails.hiringRisks > 0 ? "text-rose-600" : "text-slate-800")}>{stageDetails.hiringRisks > 0 ? `${stageDetails.hiringRisks} critical` : "0 alerts"}</span></div>
                  </div>
                  <div className="space-y-1.5 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Award className="h-3.5 w-3.5" />Critical Skillsets</p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {STAGE_SKILLS[stageDetails.key]?.map(skill => <Badge key={skill} variant="outline" className="text-[9px] font-bold uppercase py-0.5 px-2 bg-slate-50/50 text-slate-600 border-slate-200">{skill}</Badge>)}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <SectionCard title="Pipeline Transition Velocity" description="Conversion drop-off rate and resourcing flow velocity" className="lg:col-span-3" action={<TrendingUp className="h-4 w-4 text-slate-400" />}>
          <div className="space-y-5 pt-2">
            <div className="divide-y divide-slate-100">
              {flowStats.slice(0, 5).map((stage, idx) => {
                const next = flowStats[idx + 1]!;
                const conv = stage.fte > 0 ? Math.round(next.fte / stage.fte * 100) : 0;
                const [lbl, clr, bar] = conv < 50 ? ["Leakage Bottleneck", "text-rose-600", "bg-rose-500"] : conv < 80 ? ["Stable Retention", "text-amber-600", "bg-amber-500"] : ["Optimal Flow", "text-emerald-600", "bg-emerald-500"];
                return (
                  <div key={idx} className="py-3.5 first:pt-1 last:pb-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TooltipProvider><Tooltip><TooltipTrigger className="cursor-help"><span className="text-xs font-bold text-slate-800 underline decoration-dotted underline-offset-2">{stage.abbr}</span></TooltipTrigger><TooltipContent side="top" className="text-xs">{stage.label}</TooltipContent></Tooltip></TooltipProvider>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <TooltipProvider><Tooltip><TooltipTrigger className="cursor-help"><span className="text-xs font-bold text-slate-800 underline decoration-dotted underline-offset-2">{next.abbr}</span></TooltipTrigger><TooltipContent side="top" className="text-xs">{next.label}</TooltipContent></Tooltip></TooltipProvider>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">Transition</span>
                        <span className="text-[10px] font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">({stage.fte} → {next.fte} FTE)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("text-[10px] font-bold uppercase", clr)}>{lbl}</span>
                        <TooltipProvider><Tooltip><TooltipTrigger className="cursor-help"><span className="text-xs font-bold text-slate-700 font-mono underline decoration-dotted underline-offset-2">{conv}%</span></TooltipTrigger><TooltipContent side="top" className="text-xs max-w-[220px] text-center">{conv}% of FTE at {stage.label} retained into {next.label}</TooltipContent></Tooltip></TooltipProvider>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(conv, 100)}%` }} transition={{ duration: 0.5, delay: idx * 0.05 }} className={cn("h-full rounded-full", bar)} />
                    </div>
                  </div>
                );
              })}
            </div>
            {(() => {
              const ts = flowStats.slice(0, 5).map((s, i) => { const n = flowStats[i + 1]!; return { from: s.label, to: n.label, rate: s.fte > 0 ? Math.round(n.fte / s.fte * 100) : 0 }; });
              const worst = ts.reduce((a, b) => b.rate < a.rate ? b : a, ts[0]!);
              const best = ts.reduce((a, b) => b.rate > a.rate ? b : a, ts[0]!);
              return (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-500 leading-relaxed font-semibold">
                  <p className="font-bold text-slate-700 flex items-center gap-1.5 mb-1 text-[9px] uppercase tracking-wider"><RefreshCw className="h-3 w-3 text-slate-400" />Resourcing Flow Insight</p>
                  {worst && best ? <>Biggest leakage: <span className="text-rose-600 font-bold">{worst.from} &rarr; {worst.to}</span> ({worst.rate}% retention). Strongest carry-through: <span className="text-emerald-600 font-bold">{best.from} &rarr; {best.to}</span> ({best.rate}% retention). Focus scoping discipline at the {worst.from} stage.</> : "No transition data available."}
                </div>
              );
            })()}
          </div>
        </SectionCard>
      </div>

      {/* 5 — Funnel + Waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <SectionCard title="Pipeline Funnel" description="Opportunities and capacity load by HubSpot stage" className="lg:col-span-2" action={<Activity className="h-4 w-4 text-slate-400" />}>
          {funnelData.length > 0 ? (
            <div className="space-y-4 pt-2">
              {funnelData.map((d, i) => {
                const pct = Math.round((d.value / maxFunnelVal) * 100);
                return (
                  <div key={i} className="group">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                        <span className="text-xs font-bold text-slate-700 truncate">{d.name}</span>
                        <TooltipProvider><Tooltip><TooltipTrigger>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0 font-bold cursor-help" style={{ borderColor: d.fill, color: d.fill === PRIMARY ? "#fff" : d.fill, backgroundColor: d.fill === PRIMARY ? PRIMARY : `${d.fill}15` }}>{d.confidence}% win</Badge>
                        </TooltipTrigger><TooltipContent side="top" className="text-xs max-w-[200px] text-center">{d.confidence}% of gross FTE demand at this stage is expected to convert.</TooltipContent></Tooltip></TooltipProvider>
                      </div>
                      <span className="text-xs text-slate-500 font-semibold shrink-0 ml-2">{d.value} deals · <span className="text-slate-700 font-bold">{d.fte.toFixed(1)}</span> &rarr; <span className="text-indigo-700 font-bold">{d.expectedFte.toFixed(1)} FTE</span></span>
                    </div>
                    <div className="w-full h-8 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 p-0.5">
                      <div className="h-full rounded-md flex items-center justify-end pr-2.5 transition-all duration-500 relative group-hover:brightness-105" style={{ width: `${pct}%`, backgroundColor: d.fill }}>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10 rounded-md" />
                        {pct >= 22 && <span className="text-[10px] font-black text-white drop-shadow-sm select-none z-10">{pct}%</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-10">No active pipeline data.</p>}
        </SectionCard>

        <SectionCard title="Headcount Cumulative Build" description="Confidence-weighted FTE build-up per stage — cumulative waterfall" className="lg:col-span-3" action={<Scale className="h-4 w-4 text-slate-400" />}>
          <div className="pt-2">
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={waterfallData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="stage" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={24} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="base" stackId="wf" fill="transparent" stroke="none" />
                <Bar dataKey="value" stackId="wf" radius={[4, 4, 0, 0]}>{waterfallData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar>
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 justify-center border-t border-slate-100 pt-3">
              {waterfallData.filter(d => d.stage !== "Total").map(d => {
                const cfg = STAGE_CONFIG.find(c => c.shortLabel === d.stage);
                if (!cfg) return null;
                return <div key={d.stage} className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} /><span className="text-[10px] text-slate-500 font-semibold">{cfg.shortLabel} ({cfg.confidence}%)</span></div>;
              })}
              <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIMARY }} /><span className="text-[10px] text-slate-800 font-bold">Total Expected</span></div>
            </div>
          </div>
        </SectionCard>
      </div>

    </div>
  );
}
