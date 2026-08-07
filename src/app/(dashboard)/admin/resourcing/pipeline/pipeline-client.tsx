"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CLIENT_TIER_LABELS } from "@/lib/constants";
import {
  AlertTriangle, Star, Layers, Filter,
} from "lucide-react";
import type { PipelineRequestWithContext } from "@/server/services/pipeline.service";
import { PipelineAnalyticsClient } from "./analytics/pipeline-analytics-client";

// ─── Badge helpers ────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const cfg =
    confidence >= 80
      ? { color: "text-emerald-700 bg-emerald-50 border-emerald-200", label: `${confidence}% confidence` }
      : confidence >= 40
        ? { color: "text-amber-700 bg-amber-50 border-amber-200", label: `${confidence}% confidence` }
        : { color: "text-red-700 bg-red-50 border-red-200", label: `${confidence}% confidence` };
  return (
    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4.5 font-bold uppercase tracking-tight", cfg.color)}>
      {cfg.label}
    </Badge>
  );
}

function ClientTierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const cfg: Record<string, string> = {
    GOLD: "text-yellow-700 bg-yellow-50 border-yellow-300",
    SILVER: "text-slate-600 bg-slate-50 border-slate-300",
    BRONZE: "text-orange-700 bg-orange-50 border-orange-200",
  };
  return (
    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4.5 font-bold uppercase tracking-tight", cfg[tier] ?? "")}>
      <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
      {CLIENT_TIER_LABELS[tier] ?? tier}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const isResourced = status.toLowerCase().includes("resourced") && !status.toLowerCase().includes("not");
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[9px] px-1.5 py-0 h-4.5 font-bold uppercase tracking-tight",
        isResourced
          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
          : "text-amber-700 bg-amber-50 border-amber-200"
      )}
    >
      {status}
    </Badge>
  );
}

// ─── Stage helpers ────────────────────────────────────────────

const PAGE_SIZE = 25;

type StageKey = "ALL" | "INCEPTION" | "MAKE_IT_REAL" | "SCOPING";

function getDealStageKey(r: PipelineRequestWithContext): Exclude<StageKey, "ALL"> {
  if (r.sowSigned || (r.dealStage && ["SOW_SIGNED", "ACTIVE", "RAMP_DOWN"].includes(r.dealStage.toUpperCase()))) {
    return "SCOPING";
  }
  if (r.dealStage && r.dealStage.toUpperCase() === "SOW_PENDING") return "MAKE_IT_REAL";
  return "INCEPTION";
}

const STAGE_DISPLAY: Record<Exclude<StageKey, "ALL">, { label: string; cls: string }> = {
  INCEPTION: { label: "Opportunity Inception", cls: "text-slate-600 bg-slate-50 border-slate-200" },
  MAKE_IT_REAL: { label: "Make It Real", cls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  SCOPING: { label: "Scoping Approval", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
};

export function PipelineLedger({ requests }: { requests: PipelineRequestWithContext[] }) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<StageKey>("ALL");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Exclude lost deals
  const liveRequests = useMemo(() => requests.filter((r) => !r.dealLostAt), [requests]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return liveRequests
      .filter((r) => {
        const matchesSearch =
          !q ||
          (r.client?.toLowerCase().includes(q) ?? false) ||
          (r.solution?.toLowerCase().includes(q) ?? false) ||
          (r.serviceLine?.toLowerCase().includes(q) ?? false) ||
          (r.dealStage?.toLowerCase().includes(q) ?? false) ||
          (r.skillset?.toLowerCase().includes(q) ?? false);
        const matchesStage = stageFilter === "ALL" || getDealStageKey(r) === stageFilter;
        return matchesSearch && matchesStage;
      })
      .sort((a, b) => {
        const stageOrder: Record<string, number> = { SCOPING: 0, MAKE_IT_REAL: 1, INCEPTION: 2 };
        const diff = (stageOrder[getDealStageKey(a)] ?? 2) - (stageOrder[getDealStageKey(b)] ?? 2);
        if (diff !== 0) return diff;
        return (a.solutionPriority ?? 99) - (b.solutionPriority ?? 99);
      });
  }, [liveRequests, search, stageFilter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Reset pagination when filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, stageFilter]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) setVisibleCount((c) => c + PAGE_SIZE);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [hasMore]);

  return (
    <div className="space-y-6">
      {/* Report Slicers Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Report Slicers</h4>
          </div>
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider ml-auto">
            {filtered.length} deal{filtered.length !== 1 ? "s" : ""}
            {hasMore && ` · showing ${visibleCount}`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Search Deals</label>
            <Input
              placeholder="Search client, solution, service line, skillset…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-xs w-full bg-white border-slate-200 focus-visible:ring-indigo-500 font-medium text-slate-700"
            />
          </div>

          {/* Stage Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Pipeline Stage</label>
            <Select value={stageFilter} onValueChange={(v) => setStageFilter((v as StageKey) ?? "ALL")}>
              <SelectTrigger className="h-9 text-xs w-full bg-white border-slate-200 focus:ring-indigo-500 font-medium text-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs font-medium">All Stages</SelectItem>
                <SelectItem value="INCEPTION" className="text-xs font-medium">Opportunity Inception</SelectItem>
                <SelectItem value="MAKE_IT_REAL" className="text-xs font-medium">Make It Real</SelectItem>
                <SelectItem value="SCOPING" className="text-xs font-medium">Scoping Approval</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-450 py-3 pl-4 w-[240px]">Deal / Client</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-450 py-3 w-[180px]">Solution Domain</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-450 py-3 w-[160px]">Confidence & Tier</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-450 py-3 w-[130px]">Resources Needed</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-450 py-3 w-[140px]">Projected Start</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-450 py-3 w-[140px]">Service Line</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-450 py-3 pr-4 text-right w-[120px]">Resourcing Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-xs text-slate-500 font-medium">
                  No deals match your search criteria.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r) => {
                const sk = getDealStageKey(r);
                const sdsp = STAGE_DISPLAY[sk];
                return (
                  <TableRow key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    {/* Deal */}
                    <TableCell className="py-3 pl-4 align-top">
                      <p className="text-xs font-extrabold text-slate-800 leading-tight truncate max-w-[220px]" title={r.client ?? ""}>
                        {r.client ?? "Unnamed Deal"}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 font-bold uppercase tracking-tight", sdsp.cls)}>
                          {sdsp.label.split(" ").slice(0, 2).join(" ")}
                        </Badge>
                        {r.isNewClient && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-purple-700 bg-purple-50 border-purple-200 font-bold uppercase tracking-tight">
                            New
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Solution */}
                    <TableCell className="py-3 align-top">
                      {r.solution ? (
                        <div>
                          <p className="text-xs font-semibold text-slate-650 leading-tight">{r.solution}</p>
                          <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-0.5 font-bold uppercase tracking-wider">
                            <Layers className="h-2.5 w-2.5 shrink-0" />
                            Priority #{r.solutionPriority !== 99 ? r.solutionPriority : "-"}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">-</span>
                      )}
                    </TableCell>

                    {/* Confidence / Tier */}
                    <TableCell className="py-3 align-top">
                      <div className="flex flex-col gap-1 items-start">
                        <ConfidenceBadge confidence={r.confidence} />
                        <ClientTierBadge tier={r.clientTier} />
                      </div>
                    </TableCell>

                    {/* Resources */}
                    <TableCell className="py-3 align-top">
                      {r.resourceRecommended ? (
                        <div>
                          <p className="text-xs font-black text-slate-850">{r.resourceRecommended.toFixed(1)} FTE</p>
                          {r.numberOfWeeks && (
                            <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">{r.numberOfWeeks} wks span</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">-</span>
                      )}
                    </TableCell>

                    {/* Start Date */}
                    <TableCell className="py-3 align-top">
                      {r.likelyStart ? (
                        <div>
                          <p className="text-xs font-bold text-slate-750">
                            {new Date(r.likelyStart).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </p>
                          {r.hiringLeadTimeAlert && r.dealStage?.toUpperCase() !== "ACTIVE" && r.dealStage?.toUpperCase() !== "RAMP_DOWN" && (
                            <p className="text-[9px] text-rose-600 font-extrabold mt-0.5 flex items-center gap-0.5 uppercase tracking-wide">
                              <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                              Risk ({r.monthsUntilStart?.toFixed(1)}mo)
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">TBC</span>
                      )}
                    </TableCell>

                    {/* Service Line */}
                    <TableCell className="py-3 align-top">
                      {r.serviceLine ? (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-bold uppercase tracking-tight text-teal-700 bg-teal-50 border-teal-200">
                          {r.serviceLine}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">-</span>
                      )}
                    </TableCell>

                    {/* Resourcing Status */}
                    <TableCell className="py-3 pr-4 align-top text-right">
                      <StatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Infinite scroll sentinel + hint */}
      <div ref={sentinelRef} className="h-2" />
      {hasMore && (
        <p className="text-center text-[10px] text-slate-400 pb-2 font-bold uppercase tracking-wider">
          Showing {visibleCount} of {filtered.length} deals - scroll for more
        </p>
      )}
    </div>
  );
}

// ─── Unified Pipeline Client ──────────────────────────────────

export function PipelineClient({
  requests,
  benchCount,
}: {
  requests: PipelineRequestWithContext[];
  benchCount: number;
}) {
  return (
    <div className="space-y-6">
      <PipelineAnalyticsClient requests={requests} benchCount={benchCount} />
      <PipelineLedger requests={requests} />
    </div>
  );
}
