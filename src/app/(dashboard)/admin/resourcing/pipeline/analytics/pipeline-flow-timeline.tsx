"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  LabelList,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Users, AlertTriangle, Briefcase,
  ArrowRight, Activity, Scale, Info,
  Award, RefreshCw, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeResourceRequest } from "@/lib/role-mapping";
import type { PipelineRequestWithContext } from "@/server/services/pipeline.service";
import { SectionCard } from "../../../analytics/analytics-client";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

// ─── Theme Colors ─────────────────────────────────────────────
const PRIMARY = "#19105b"; // Deep Navy
const SECONDARY = "#ff6196"; // Vibrant Pink

const STAGE_FLOW_CONFIG = [
  { key: "LEAD", abbr: "OI", label: "Opportunity Inception", align: "down", color: "#64748b", desc: "Early-stage leads identified in HubSpot. Raw interest and initial staffing scoping." },
  { key: "PROPOSAL", abbr: "MIR", label: "Make It Real", align: "up", color: "#818cf8", desc: "Proposal submitted. Scopes finalized, matching initial skill requirements." },
  { key: "SOW_PENDING", abbr: "BP", label: "Build Proposition", align: "down", color: "#fb7185", desc: "SOW draft prepared and pending review. High probability of resource demand." },
  { key: "SOW_SIGNED", abbr: "SOW", label: "SOW Signed", align: "up", color: SECONDARY, desc: "Scoping approved and signed. Allocations ready to be locked into projects." },
  { key: "ACTIVE", abbr: "ACT", label: "Active Delivery", align: "down", color: PRIMARY, desc: "Active delivery. FTEs on the field, utilizing core skills." },
  { key: "RAMP_DOWN", abbr: "EXT", label: "Extension/Ramp Down", align: "up", color: "#6366f1", desc: "Project near completion. Assessing renewal extensions or bench release." },
] as const;

const STAGE_SKILLS: Record<string, string[]> = {
  LEAD: ["Client Discovery", "Initial Scoping", "Commercial Strategy"],
  PROPOSAL: ["Solution Architecture", "FTE Estimations", "Tech Stack Mapping"],
  SOW_PENDING: ["Contractual SOW", "Resource Matching", "Commercial Review"],
  SOW_SIGNED: ["Pre-onboarding", "Resource Allocation", "Project Kickoff"],
  ACTIVE: ["Active Delivery", "Focal Competencies", "SLA Monitoring"],
  RAMP_DOWN: ["Transition Planning", "Resource Release", "Extension Scoping"],
};

function normalizeStage(raw: string | null): string {
  if (!raw) return "UNKNOWN";
  return raw.toUpperCase().replace(/\s+/g, "_");
}

/** FTE demand for a deal, parsed from its resource request (same parser the forecast uses). */
function dealFte(r: { resourcesRequested: string | null }): number {
  return r.resourcesRequested ? normalizeResourceRequest(r.resourcesRequested).count : 0;
}

/** Converts monthsUntilStart + likelyStart into a clear human label, e.g. "~9 days (Jul 5)" */
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
  const mo = months.toFixed(1);
  return `~${mo} months${suffix}`;
}

interface PipelineFlowTimelineProps {
  requests: PipelineRequestWithContext[];
  benchCount: number;
}

export function PipelineFlowTimeline({ requests, benchCount }: PipelineFlowTimelineProps) {
  const active = useMemo(() => requests.filter((r) => !r.dealLostAt), [requests]);
  const [selectedStage, setSelectedStage] = useState<string>("LEAD");

  // Compute stats per stage
  const flowStats = useMemo(() => {
    return STAGE_FLOW_CONFIG.map((cfg) => {
      const deals = active.filter((r) => normalizeStage(r.dealStage) === cfg.key);
      const fte = deals.reduce((s, r) => s + dealFte(r), 0);

      let winProb = 0.2;
      if (cfg.key === "SOW_PENDING") winProb = 0.4;
      else if (cfg.key === "SOW_SIGNED") winProb = 0.8;
      else if (cfg.key === "ACTIVE") winProb = 1.0;
      else if (cfg.key === "RAMP_DOWN") winProb = 1.0;

      const weightedFte = fte * winProb;
      // Active Delivery and Ramp Down are already staffed - no hiring shortage applies
      const atRiskDeals = (cfg.key === "ACTIVE" || cfg.key === "RAMP_DOWN")
        ? []
        : deals.filter(r => r.hiringLeadTimeAlert);
      const hiringRisks = atRiskDeals.length;
      const avgDuration = deals.filter(r => r.numberOfWeeks).reduce((s, r) => s + (r.numberOfWeeks ?? 0), 0) / (deals.filter(r => r.numberOfWeeks).length || 1);

      return {
        ...cfg,
        dealCount: deals.length,
        fte: Math.round(fte * 10) / 10,
        weightedFte: Math.round(weightedFte * 10) / 10,
        hiringRisks,
        atRiskDeals,
        avgDuration: Math.round(avgDuration * 10) / 10 || 0,
        winProb: Math.round(winProb * 100)
      };
    });
  }, [active]);

  // Selected stage details
  const stageDetails = useMemo(() => {
    return flowStats.find((s) => s.key === selectedStage);
  }, [flowStats, selectedStage]);

  // Snowball Bridge filtered by selected stage - updates when a stage node is clicked
  const bridgeData = useMemo(() => {
    const stageDeals = active.filter(r => normalizeStage(r.dealStage) === selectedStage);
    const stageCfg = STAGE_FLOW_CONFIG.find(s => s.key === selectedStage);

    const winProb = stageCfg?.key === "ACTIVE" || stageCfg?.key === "RAMP_DOWN" ? 1.0
      : stageCfg?.key === "SOW_SIGNED" ? 0.8
        : stageCfg?.key === "SOW_PENDING" ? 0.4
          : 0.2;

    const grossFte = stageDeals.reduce((s, r) => s + dealFte(r), 0);
    const haircutFte = grossFte * (1 - winProb);
    const expectedFte = grossFte * winProb;

    const grossVal = Math.round(grossFte * 10) / 10;
    const haircutVal = Math.round(haircutFte * 10) / 10;
    const expectedVal = Math.round(expectedFte * 10) / 10;

    return [
      { name: "Stage Gross Demand", base: 0, value: grossVal, displayVal: `${grossVal} FTE`, type: "pillar", fill: PRIMARY },
      { name: "Win Prob. Haircut", base: grossVal - haircutVal, value: haircutVal, displayVal: `(${haircutVal}) FTE`, type: "leakage", fill: SECONDARY },
      { name: "Expected Net Demand", base: 0, value: expectedVal, displayVal: `${expectedVal} FTE`, type: "pillar", fill: PRIMARY },
    ];
  }, [active, selectedStage]);

  return (
    <div className="space-y-6">

      {/* ── Horizontal Flow Timeline Card ── */}
      <SectionCard
        title="Pipeline Flow & Funnel Timeline"
        description="Horizontal pipeline stages with branching demand metrics (Opportunity count vs. FTE demand)"
        action={<Activity className="h-4 w-4 text-slate-400" />}
        flush
        className="relative"
      >
        {/* Outer scroll container to prevent cut-off at screen edges */}
        <div className="overflow-x-auto pb-10 pt-10 px-6 w-full scrollbar-thin">
          <div className="min-w-[920px] relative h-[420px] p-0">

            {/* Central pipeline (pipe) */}
            <div className="w-[84%] h-6 bg-slate-100 rounded-full border border-slate-200/50 absolute left-[8%] right-[8%] top-[210px] -translate-y-1/2 shadow-inner overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-slate-400 via-indigo-500 to-[#ff6196] relative flex items-center justify-around px-10"
              >
                <ChevronRight className="h-4 w-4 text-white/75 shrink-0" />
                <ChevronRight className="h-4 w-4 text-white/75 shrink-0" />
                <ChevronRight className="h-4 w-4 text-white/75 shrink-0" />
                <ChevronRight className="h-4 w-4 text-white/75 shrink-0" />
                <ChevronRight className="h-4 w-4 text-white/75 shrink-0" />
                <ChevronRight className="h-4 w-4 text-white/75 shrink-0" />
              </motion.div>
            </div>

            {/* Timeline Nodes */}
            <div className="w-[84%] flex justify-between items-center absolute left-[8%] right-[8%] top-[210px] -translate-y-1/2 z-10">
              {flowStats.map((stage, idx) => {
                const isSelected = selectedStage === stage.key;
                const isUp = stage.align === "up";

                return (
                  <div key={stage.key} className="relative flex flex-col items-center">

                    {/* Visual Node Dot on the Pipeline */}
                    <motion.button
                      whileHover={{ scale: 1.25 }}
                      onClick={() => setSelectedStage(stage.key)}
                      className={cn(
                        "h-5 w-5 rounded-full border-2 bg-white flex items-center justify-center shadow-md relative z-20 transition-all outline-none cursor-pointer",
                        isSelected
                          ? stage.key === "ACTIVE"
                            ? "border-emerald-500 ring-4 ring-emerald-500/15 scale-120"
                            : stage.key === "RAMP_DOWN"
                              ? "border-indigo-400 ring-4 ring-indigo-400/15 scale-120"
                              : stage.hiringRisks > 0
                                ? "border-rose-500 ring-4 ring-rose-500/15 scale-120"
                                : "border-[#ff6196] ring-4 ring-[#ff6196]/15 scale-120"
                          : stage.key === "ACTIVE"
                            ? "border-emerald-400 bg-emerald-50"
                            : stage.key === "RAMP_DOWN"
                              ? "border-indigo-300 bg-indigo-50"
                              : stage.hiringRisks > 0
                                ? "border-rose-300 bg-rose-50"
                                : "border-slate-300"
                      )}
                    >
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          isSelected
                            ? stage.key === "ACTIVE" ? "bg-emerald-500"
                              : stage.key === "RAMP_DOWN" ? "bg-indigo-400"
                                : stage.hiringRisks > 0 ? "bg-rose-500" : "bg-[#ff6196]"
                            : stage.key === "ACTIVE" ? "bg-emerald-400"
                              : stage.key === "RAMP_DOWN" ? "bg-indigo-300"
                                : stage.hiringRisks > 0 ? "bg-rose-500 animate-pulse" : "bg-slate-300"
                        )}
                      />
                    </motion.button>

                    {/* Branch Line & Cap */}
                    <div
                      className={cn(
                        "absolute flex flex-col items-center",
                        isUp ? "bottom-2.5" : "top-2.5"
                      )}
                    >
                      {/* Vertical Line */}
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 24 }}
                        transition={{ delay: idx * 0.08, duration: 0.4 }}
                        className={cn(
                          "w-0.5 relative",
                          stage.key === "ACTIVE" ? "bg-emerald-300"
                            : stage.key === "RAMP_DOWN" ? "bg-indigo-300"
                              : stage.hiringRisks > 0 ? "bg-rose-300" : "bg-slate-300",
                          isUp ? "flex flex-col-reverse" : "flex flex-col"
                        )}
                      >
                        {/* Horizontal T-Cap at the end of vertical branch */}
                        <div
                          className={cn(
                            "w-3 h-0.5 absolute left-[-5px]",
                            stage.key === "ACTIVE" ? "bg-emerald-300"
                              : stage.key === "RAMP_DOWN" ? "bg-indigo-300"
                                : stage.hiringRisks > 0 ? "bg-rose-300" : "bg-slate-300"
                          )}
                          style={{ [isUp ? "top" : "bottom"]: 0 }}
                        />
                      </motion.div>

                      {/* Stage Card at the Tip of the Branch - Enlarged and Richer Details */}
                      <motion.div
                        initial={{ opacity: 0, y: isUp ? -15 : 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.07, zIndex: 50 }}
                        transition={{ delay: idx * 0.1 + 0.15, duration: 0.3 }}
                        onClick={() => setSelectedStage(stage.key)}
                        style={{ originX: "50%", originY: isUp ? "100%" : "0%" }}
                        className={cn(
                          "absolute w-40 rounded-xl border p-2.5 shadow-sm bg-white/95 cursor-pointer select-none",
                          isUp ? "bottom-[24px]" : "top-[24px]",
                          isSelected
                            ? stage.key === "ACTIVE"
                              ? "border-emerald-500 shadow-md shadow-emerald-50 ring-2 ring-emerald-500/10"
                              : stage.key === "RAMP_DOWN"
                                ? "border-indigo-400 shadow-md shadow-indigo-50 ring-2 ring-indigo-400/10"
                                : stage.hiringRisks > 0
                                  ? "border-rose-500 shadow-md shadow-rose-50 ring-2 ring-rose-500/10"
                                  : "border-[#ff6196] shadow-md shadow-rose-50 ring-2 ring-[#ff6196]/10"
                            : stage.key === "ACTIVE"
                              ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-400"
                              : stage.key === "RAMP_DOWN"
                                ? "border-indigo-200 bg-indigo-50/30 hover:border-indigo-300"
                                : stage.hiringRisks > 0
                                  ? "border-rose-300 bg-rose-50/50 hover:border-rose-400"
                                  : "border-slate-200/80 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-bold text-slate-400">
                            {stage.key === "ACTIVE" ? "On Delivery" : stage.key === "RAMP_DOWN" ? "Post-Delivery" : "Probability"}
                          </span>
                          <span className={cn(
                            "text-[9px] font-black",
                            stage.key === "ACTIVE" ? "text-emerald-600" :
                              stage.key === "RAMP_DOWN" ? "text-indigo-500" :
                                stage.hiringRisks > 0 ? "text-rose-600" : "text-slate-500"
                          )}>
                            {stage.key === "ACTIVE" ? "LIVE ✓" : stage.key === "RAMP_DOWN" ? "EXT / ↓" : `${stage.winProb}% win`}
                          </span>
                        </div>

                        <p className={cn(
                          "text-[11px] font-black tracking-tight leading-tight mt-1 mb-1",
                          stage.key === "ACTIVE" ? "text-emerald-800" :
                            stage.key === "RAMP_DOWN" ? "text-indigo-700" :
                              stage.hiringRisks > 0 ? "text-rose-800" : "text-slate-850"
                        )}>
                          {stage.label}
                        </p>

                        {/* Resource shortage - badge triggers tooltip with per-deal reasons */}
                        {stage.hiringRisks > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="text-[9px] font-extrabold text-rose-600 bg-rose-50/80 border border-rose-100 rounded px-1.5 py-0.5 mt-1 mb-1 flex items-center gap-1 select-none animate-pulse cursor-help w-fit">
                                  <AlertTriangle className="h-2.5 w-2.5 text-rose-500 shrink-0" />
                                  <span>{stage.hiringRisks} Resource Shortage{stage.hiringRisks > 1 ? "s" : ""}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="!flex-col !items-start !gap-1 max-w-[220px] whitespace-normal">
                                <p className="font-semibold text-[11px] border-b border-slate-700 pb-1 mb-0.5 w-full">Start &lt; 6mo - urgent hiring needed</p>
                                {stage.atRiskDeals.slice(0, 5).map((deal, di) => (
                                  <p key={di} className="text-[10px] leading-snug w-full">
                                    <span className="font-semibold text-slate-200">{deal.client ?? "Unknown"}</span>
                                    {deal.skillset ? <span className="text-slate-400"> · {deal.skillset}</span> : null}
                                    <span className="block text-rose-400 font-semibold text-[9px]">{formatLeadTime(deal.monthsUntilStart, deal.likelyStart)}</span>
                                  </p>
                                ))}
                                {stage.atRiskDeals.length > 5 && (
                                  <p className="text-[10px] text-slate-400">+{stage.atRiskDeals.length - 5} more deals at risk</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {/* Rich metrics details inside the card */}
                        <div className="mt-2 pt-1.5 border-t border-slate-100 space-y-1 text-[9px] font-semibold text-slate-500">
                          <div className="flex justify-between items-center">
                            <span>Deals Count</span>
                            <span className="font-bold text-slate-700">{stage.dealCount}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Gross Demand</span>
                            <span className="font-bold text-slate-700">{stage.fte.toFixed(1)} FTE</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Expected Net</span>
                            <span className={cn("font-bold", stage.hiringRisks > 0 ? "text-rose-600 font-extrabold" : "text-slate-700")}>
                              {stage.weightedFte.toFixed(1)} FTE
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Avg Duration</span>
                            <span className="font-bold text-slate-700">{stage.avgDuration} wks</span>
                          </div>
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

      {/* ── Pipeline Stage Details Card & Transition Velocity side-by-side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Stage details panel - Redesigned with visual ring and premium details */}
        {/* Stage details panel - Simplified */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden lg:col-span-2">
          <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/20">
            <h3 className="font-bold text-sm text-slate-800 tracking-tight flex items-center gap-2">
              <Info className="h-4 w-4 text-slate-400" />
              Stage Analytics
            </h3>
            {stageDetails && (
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {stageDetails.abbr} Phase
              </span>
            )}
          </div>
          <div className="flex-1 px-6 pb-6 pt-5 space-y-5">
            <AnimatePresence mode="wait">
              {stageDetails && (
                <motion.div
                  key={stageDetails.key}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-5"
                >
                  {/* Phase & Win Rate */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Stage</span>
                      <h4 className="font-black text-slate-950 text-lg leading-tight">{stageDetails.label}</h4>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold",
                      stageDetails.key === "ACTIVE" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : stageDetails.key === "RAMP_DOWN" ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                    )}>
                      <span>
                        {stageDetails.key === "ACTIVE" ? "Confirmed - Live"
                          : stageDetails.key === "RAMP_DOWN" ? "Confirmed - Post-Delivery"
                            : `${stageDetails.winProb}% Win Prob.`}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {stageDetails.desc}
                  </p>

                  {/* Stage Metrics list */}
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-slate-650">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                        Average Project Span
                      </span>
                      <span className="font-bold text-slate-800">{stageDetails.avgDuration} weeks</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-650">
                      <span className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                        Hiring Alerts (&lt; 6mo)
                      </span>
                      <span className={cn("font-bold", stageDetails.hiringRisks > 0 ? "text-rose-600 font-extrabold" : "text-slate-800")}>
                        {stageDetails.hiringRisks > 0 ? `${stageDetails.hiringRisks} critical` : "0 alerts"}
                      </span>
                    </div>
                  </div>

                  {/* Stage Key Skills */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Award className="h-3.5 w-3.5 text-slate-400" />
                      Critical Stage Skillsets
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {STAGE_SKILLS[stageDetails.key]?.map((skill) => (
                        <Badge
                          key={skill}
                          variant="outline"
                          className="text-[9px] font-bold uppercase tracking-tight py-0.5 px-2 bg-slate-50/50 text-slate-600 border-slate-200"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Pipeline Stage Transition Velocity Analysis - Simplified */}
        <SectionCard
          title="Pipeline Transition Velocity"
          description="Conversion drop-off rate and resourcing flow velocity"
          className="lg:col-span-3"
          action={<TrendingUp className="h-4 w-4 text-slate-400" />}
        >
          <div className="space-y-5 pt-2">
            <div className="divide-y divide-slate-100">
              {flowStats.slice(0, 5).map((stage, idx) => {
                const nextStage = flowStats[idx + 1]!;
                const conversion = stage.fte > 0 ? Math.round(nextStage.fte / stage.fte * 100) : 0;

                // Determine health index based on retention
                let statusLabel = "Optimal Flow";
                let statusColor = "text-emerald-600";
                let barColor = "bg-emerald-500";
                if (conversion < 50) {
                  statusLabel = "Leakage Bottleneck";
                  statusColor = "text-rose-600";
                  barColor = "bg-rose-500";
                } else if (conversion < 80) {
                  statusLabel = "Stable Retention";
                  statusColor = "text-amber-600";
                  barColor = "bg-amber-500";
                }

                return (
                  <div key={idx} className="py-3.5 first:pt-1 last:pb-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">
                              <span className="text-xs font-bold text-slate-800 underline decoration-dotted decoration-slate-300 underline-offset-2">{stage.abbr}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs font-semibold">{stage.label}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">
                              <span className="text-xs font-bold text-slate-800 underline decoration-dotted decoration-slate-300 underline-offset-2">{nextStage.abbr}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs font-semibold">{nextStage.label}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">Transition</span>
                        <span className="text-[10px] text-slate-450 font-medium font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100/80">
                          ({stage.fte} FTE → {nextStage.fte} FTE)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider", statusColor)}>
                          {statusLabel}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">
                              <span className="text-xs font-bold text-slate-700 min-w-[36px] text-right font-mono underline decoration-dotted decoration-slate-300 underline-offset-2">{conversion}%</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[220px] text-center">
                              FTE carry-through rate - {conversion}% of gross FTE demand at <span className="font-bold">{stage.label}</span> ({stage.fte} FTE) is retained into <span className="font-bold">{nextStage.label}</span> ({nextStage.fte} FTE)
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    {/* Simple progress gauge */}
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(conversion, 100)}%` }}
                        transition={{ duration: 0.5, delay: idx * 0.05 }}
                        className={cn("h-full rounded-full", barColor)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Analytical insight - derived from actual conversion data */}
            {(() => {
              const transitions = flowStats.slice(0, 5).map((s, i) => {
                const next = flowStats[i + 1]!;
                return { from: s.label, to: next.label, rate: s.fte > 0 ? Math.round(next.fte / s.fte * 100) : 0 };
              });
              const worst = transitions.reduce((a, b) => b.rate < a.rate ? b : a, transitions[0]!);
              const best = transitions.reduce((a, b) => b.rate > a.rate ? b : a, transitions[0]!);
              return (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-500 leading-relaxed font-semibold">
                  <p className="font-bold text-slate-700 flex items-center gap-1.5 mb-1 text-[9px] uppercase tracking-wider">
                    <RefreshCw className="h-3 w-3 text-slate-400" />
                    Resourcing Flow Insight
                  </p>
                  {worst && best ? (
                    <>Biggest leakage: <span className="text-rose-600 font-bold">{worst.from} → {worst.to}</span> ({worst.rate}% retention). Strongest carry-through: <span className="text-emerald-600 font-bold">{best.from} → {best.to}</span> ({best.rate}% retention). Focus scoping discipline at the {worst.from} stage to reduce downstream FTE haircut.</>
                  ) : "No transition data available."}
                </div>
              );
            })()}
          </div>
        </SectionCard>      </div>

    </div>
  );
}
