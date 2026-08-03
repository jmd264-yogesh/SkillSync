"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  ChevronUp, ChevronDown, Search, Filter,
  BarChart3, DollarSign, Activity, Shield,
  ArrowUpRight, Star, Users, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type {
  ExtensionForecastRow,
  ExtensionSummary,
  ExtensionSignal,
} from "@/server/services/extension-forecast.service";

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return "—";
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}K`;
  return `£${n.toFixed(0)}`;
}

const STATUS_LABEL: Record<string, string> = {
  "▲▲": "Strong growth",
  "▲": "Growing",
  "▶": "Stable",
  "▼": "Declining",
  "▼▼": "Strong decline",
};

const BAND_CONFIG = {
  VERY_LIKELY: {
    label: "Very Likely",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ring: "#10b981",
    dot: "bg-emerald-500",
  },
  LIKELY: {
    label: "Likely",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    ring: "#3b82f6",
    dot: "bg-blue-500",
  },
  UNCERTAIN: {
    label: "Uncertain",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    ring: "#f59e0b",
    dot: "bg-amber-500",
  },
  UNLIKELY: {
    label: "Unlikely",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    badge: "bg-red-100 text-red-700 border-red-200",
    ring: "#ef4444",
    dot: "bg-red-500",
  },
  UNKNOWN: {
    label: "Unknown",
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-500",
    badge: "bg-slate-100 text-slate-500 border-slate-200",
    ring: "#94a3b8",
    dot: "bg-slate-400",
  },
};

const LEVEL_BADGE: Record<string, string> = {
  Gold: "bg-amber-100 text-amber-800 border-amber-200",
  Silver: "bg-slate-100 text-slate-700 border-slate-200",
  Bronze: "bg-orange-100 text-orange-700 border-orange-200",
  Servicing: "bg-purple-100 text-purple-700 border-purple-200",
};

const SIGNAL_COLOUR: Record<string, string> = {
  green: "bg-emerald-50 border-emerald-200 text-emerald-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  red: "bg-red-50 border-red-200 text-red-700",
  muted: "bg-slate-50 border-slate-200 text-slate-500",
};

function StatusArrow({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-300">—</span>;
  const icon =
    status === "▲▲" ? <TrendingUp className="h-4 w-4 text-emerald-500" /> :
    status === "▲"  ? <ChevronUp className="h-4 w-4 text-emerald-400" /> :
    status === "▶"  ? <Minus className="h-4 w-4 text-amber-400" /> :
    status === "▼"  ? <ChevronDown className="h-4 w-4 text-red-400" /> :
    status === "▼▼" ? <TrendingDown className="h-4 w-4 text-red-500" /> :
    <Minus className="h-4 w-4 text-slate-300" />;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>{icon}</TooltipTrigger>
        <TooltipContent>{STATUS_LABEL[status] ?? status}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Score Ring ────────────────────────────────────────────────
function ScoreRing({ score, band }: { score: number; band: string }) {
  const cfg = BAND_CONFIG[band as keyof typeof BAND_CONFIG] ?? BAND_CONFIG.UNKNOWN;
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={56} height={56} className="-rotate-90">
        <circle cx={28} cy={28} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
        <circle
          cx={28} cy={28} r={r}
          fill="none"
          stroke={cfg.ring}
          strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <span className={`absolute text-[13px] font-bold ${cfg.text}`}>{score}</span>
    </div>
  );
}

// ── Signal Chip ───────────────────────────────────────────────
function SignalChip({ signal }: { signal: ExtensionSignal }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${SIGNAL_COLOUR[signal.colour]}`}>
            {signal.label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <div className="font-semibold">{signal.label}</div>
            <div>{signal.value}</div>
            <div className="text-slate-400">Weight: {Math.round(signal.weight * 100)}%</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import { setExtensionForecastOverride } from "@/server/actions/extension-forecast";
import { Edit3, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// ── Override Modal Component ──────────────────────────────────
function OverrideDialog({
  row,
  open,
  onOpenChange,
  onUpdated,
}: {
  row: ExtensionForecastRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (updated: ExtensionForecastRow) => void;
}) {
  const [overrideStatus, setOverrideStatus] = useState<string>(row?.overrideStatus ?? "NONE");
  const [overrideNotes, setOverrideNotes] = useState<string>(row?.overrideNotes ?? "");
  const [loading, setLoading] = useState(false);

  // Sync state when row changes
  useMemo(() => {
    if (row) {
      setOverrideStatus(row.overrideStatus ?? "NONE");
      setOverrideNotes(row.overrideNotes ?? "");
    }
  }, [row]);

  if (!row) return null;

  const initialStatus = row.overrideStatus ?? "NONE";
  const initialNotes = row.overrideNotes ?? "";
  const hasChanges = overrideStatus !== initialStatus || overrideNotes.trim() !== initialNotes.trim();

  async function handleSave() {
    try {
      setLoading(true);
      const res = await setExtensionForecastOverride({
        id: row!.id,
        overrideStatus: overrideStatus === "NONE" ? null : overrideStatus,
        overrideNotes,
      });
      onUpdated(res);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-6 rounded-xl border border-slate-200 bg-white shadow-xl">
        <DialogHeader className="space-y-1.5 pb-2.5 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <div className="bg-violet-100 p-2 rounded-lg">
              <Edit3 className="h-4.5 w-4.5 text-violet-600" />
            </div>
            <span>Extension Intent Override</span>
          </DialogTitle>
          <p className="text-xs text-slate-500 font-normal">
            Adjust qualitative forecast for <strong className="text-slate-800">{row.portCo}</strong> ({row.fund}).
          </p>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="bg-slate-50/80 border border-slate-100 p-3 rounded-lg text-xs grid grid-cols-2 gap-4">
            <div>
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Parent Fund</span>
              <span className="font-semibold text-slate-700">{row.fund}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Algorithmic Baseline</span>
              <span className="font-bold text-slate-700">{row.extensionScore}% ({row.extensionBand})</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Project Extension Intent Signal</label>
            <Select value={overrideStatus} onValueChange={(v) => setOverrideStatus(v ?? "NONE")}>
              <SelectTrigger className="h-10 text-xs border-slate-200 bg-white focus:ring-violet-500 w-full font-medium">
                <SelectValue placeholder="Select override intent..." />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[500px]">
                <SelectItem value="NONE" className="text-xs py-2">⚙️ Auto (Use Revenue/Algorithmic Forecast)</SelectItem>
                <SelectItem value="CONFIRMED_EXTENSION" className="text-xs py-2">🟢 Confirmed Extension (PM/Client Agreed) → 95% Score</SelectItem>
                <SelectItem value="LIKELY_EXTENSION" className="text-xs py-2">🟢 Likely Extension (Conversations Active) → 80% Score</SelectItem>
                <SelectItem value="UNLIKELY_EXTENSION" className="text-xs py-2">🟠 Unlikely to Extend (Budget/Scope Risk) → 35% Score</SelectItem>
                <SelectItem value="CONFIRMED_DROPPING" className="text-xs py-2">🔴 Confirmed Dropping (Project Ending) → 10% Score</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400 leading-tight">
              Manual inputs override algorithmic revenue scores across Extension Radar & Resourcing Simulator rankings.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Notes / Rationale</label>
            <textarea
              value={overrideNotes}
              onChange={(e) => setOverrideNotes(e.target.value)}
              placeholder="e.g. Client confirmed SOW extension in weekly status meeting..."
              className="w-full h-20 text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={loading} className="text-slate-500">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading || !hasChanges}
            className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium px-4 transition-all"
          >
            {loading ? "Saving..." : "Save Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Card ──────────────────────────────────────────────────────
function ExtensionCard({
  row,
  onEdit,
}: {
  row: ExtensionForecastRow;
  onEdit: (row: ExtensionForecastRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = BAND_CONFIG[row.effectiveBand as keyof typeof BAND_CONFIG] ?? BAND_CONFIG.UNKNOWN;
  const levelCls = LEVEL_BADGE[row.level ?? ""] ?? LEVEL_BADGE.Bronze;
  const hasOverride = Boolean(row.overrideStatus && row.overrideStatus !== "NONE");

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 flex flex-col justify-between hover:shadow-md transition-all duration-200 relative group`}>
      {/* Card Header & Content */}
      <div className="space-y-3">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[14px] font-bold text-slate-900 truncate tracking-tight">{row.portCo}</span>
              <StatusArrow status={row.status} />
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[11px] font-medium text-slate-500">{row.fund}</span>
              {row.level && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full border ${levelCls}`}>
                  {row.level}
                </span>
              )}
              {row.cluster && (
                <span className="text-[10px] text-slate-500 bg-slate-150 px-1.5 py-0.2 rounded-full font-medium">
                  {row.cluster}
                </span>
              )}
              {hasOverride && (
                <span className="text-[9px] font-bold text-violet-700 bg-violet-100 border border-violet-200 px-1.5 py-0.2 rounded-full">
                  Override
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col items-end gap-0.5">
              <ScoreRing score={row.effectiveScore} band={row.effectiveBand} />
              <span className={`text-[9px] font-bold uppercase tracking-wider ${cfg.text}`}>
                {cfg.label}
              </span>
            </div>
            <button
              onClick={() => onEdit(row)}
              className="p-1.5 rounded-lg bg-white/90 border border-slate-200 text-slate-400 hover:text-violet-600 hover:border-violet-300 hover:bg-white transition-all shadow-2xs"
              title="Override extension data"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Revenue Summary Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/70 rounded-lg p-2 border border-white/90 shadow-2xs">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">FY Booked</div>
            <div className="text-[13px] font-bold text-slate-800">{fmt(row.fyBooked)}</div>
          </div>
          <div className="bg-white/70 rounded-lg p-2 border border-white/90 shadow-2xs">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">3M Pipeline</div>
            <div className="text-[13px] font-bold text-slate-800">{fmt(row.forwardWeighted)}</div>
          </div>
        </div>

        {/* Signal Chips */}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {row.signals.map((s) => (
            <SignalChip key={s.label} signal={s} />
          ))}
        </div>

        {row.overrideNotes && (
          <div className="text-[11px] text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-200/60 italic leading-snug">
            "{row.overrideNotes}"
          </div>
        )}
      </div>

      {/* Footer / Expand Button */}
      <div className="pt-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Hide" : "Show"} monthly breakdown
        </button>

        {expanded && (
          <div className="border-t border-white/80 pt-2.5 mt-2 space-y-2">
            <div className="grid grid-cols-3 gap-1 text-[10px] font-semibold text-slate-400 px-1">
              <span>Month</span><span>Booked</span><span>Weighted</span>
            </div>
            {[
              { label: "Jul-26 (current)", booked: row.bookedCurrent, weighted: row.weightedCurrent },
              { label: "Aug-26", booked: row.bookedMonth1, weighted: row.weightedMonth1 },
              { label: "Sep-26", booked: row.bookedMonth2, weighted: row.weightedMonth2 },
              { label: "Oct-26", booked: row.bookedMonth3, weighted: row.weightedMonth3 },
            ].map((m) => (
              <div key={m.label} className="grid grid-cols-3 gap-1 text-[11px] px-1">
                <span className="text-slate-500">{m.label}</span>
                <span className="font-medium text-slate-700">{fmt(m.booked)}</span>
                <span className="font-medium text-slate-700">{fmt(m.weighted)}</span>
              </div>
            ))}

            {(row.accountManager || row.teamOwner) && (
              <div className="flex items-center gap-3 pt-1 border-t border-white/60 text-[11px] text-slate-500">
                {row.accountManager && <span><span className="font-medium">AM:</span> {row.accountManager}</span>}
                {row.teamOwner && <span><span className="font-medium">TO:</span> {row.teamOwner}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Summary KPI Bar ───────────────────────────────────────────
function SummaryBar({ summary }: { summary: ExtensionSummary }) {
  const kpis = [
    {
      label: "Portfolio Clients",
      value: summary.totalEntries,
      icon: Users,
      colour: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Avg Extension Score",
      value: `${summary.avgScore}/100`,
      icon: Activity,
      colour: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "FY Booked Revenue",
      value: fmt(summary.totalFyBooked),
      icon: DollarSign,
      colour: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Forward Weighted Pipeline",
      value: fmt(summary.totalFyWeighted),
      icon: BarChart3,
      colour: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  const bandOrder = ["VERY_LIKELY", "LIKELY", "UNCERTAIN", "UNLIKELY"] as const;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`${k.bg} p-2 rounded-lg shrink-0`}>
              <k.icon className={`h-4 w-4 ${k.colour}`} />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">{k.label}</div>
              <div className="text-[16px] font-bold text-slate-800">{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Band distribution */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-slate-400" />
          <span className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide">Extension likelihood distribution</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {bandOrder.map((band) => {
            const cfg = BAND_CONFIG[band];
            const count = summary.byBand[band] ?? 0;
            const pct = summary.totalEntries > 0
              ? Math.round((count / summary.totalEntries) * 100)
              : 0;
            return (
              <div key={band} className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                <span className="text-[12px] text-slate-600 font-medium">{cfg.label}</span>
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.badge}`}>
                  {count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
        {/* Distribution bar */}
        <div className="mt-3 h-2 rounded-full overflow-hidden flex bg-slate-100">
          {bandOrder.map((band) => {
            const cfg = BAND_CONFIG[band];
            const count = summary.byBand[band] ?? 0;
            const pct = summary.totalEntries > 0 ? (count / summary.totalEntries) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={band}
                style={{ width: `${pct}%`, backgroundColor: cfg.ring }}
                className="h-full transition-all"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Data Table ────────────────────────────────────────────────
function ExtensionTable({
  rows,
  onEdit,
}: {
  rows: ExtensionForecastRow[];
  onEdit: (row: ExtensionForecastRow) => void;
}) {
  type SortKey = "effectiveScore" | "fyBooked" | "forwardWeighted" | "portCo";
  const [sortKey, setSortKey] = useState<SortKey>("effectiveScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "string"
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`flex items-center gap-0.5 ${active ? "text-slate-800" : "text-slate-400 hover:text-slate-600"}`}
      >
        {label}
        {active && (sortDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 border-b border-slate-100">
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide w-[200px]">
              <SortBtn k="portCo" label="PortCo" />
            </TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Fund</TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Tier</TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Trend</TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              <SortBtn k="effectiveScore" label="Score" />
            </TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Band</TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-right">
              <SortBtn k="fyBooked" label="FY Booked" />
            </TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-right">
              <SortBtn k="forwardWeighted" label="3M Weighted" />
            </TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-right">FY Weighted</TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-center w-12">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => {
            const cfg = BAND_CONFIG[row.effectiveBand as keyof typeof BAND_CONFIG] ?? BAND_CONFIG.UNKNOWN;
            const levelCls = LEVEL_BADGE[row.level ?? ""] ?? LEVEL_BADGE.Bronze;
            const hasOverride = Boolean(row.overrideStatus && row.overrideStatus !== "NONE");
            return (
              <TableRow
                key={row.id}
                className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
              >
                <TableCell className="font-semibold text-[13px] text-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span>{row.portCo}</span>
                    {hasOverride && (
                      <span className="text-[9px] font-bold text-violet-700 bg-violet-100 border border-violet-200 px-1 py-0.2 rounded">
                        Override
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-[12px] text-slate-500">{row.fund}</TableCell>
                <TableCell>
                  {row.level && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${levelCls}`}>
                      {row.level}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <StatusArrow status={row.status} />
                    <span className="text-[11px] text-slate-400 hidden xl:block">
                      {STATUS_LABEL[row.status ?? ""] ?? ""}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${row.effectiveScore}%`, backgroundColor: cfg.ring }}
                      />
                    </div>
                    <span className={`text-[12px] font-bold ${cfg.text}`}>{row.effectiveScore}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium text-[12px] text-slate-700">{fmt(row.fyBooked)}</TableCell>
                <TableCell className="text-right font-medium text-[12px] text-slate-700">{fmt(row.forwardWeighted)}</TableCell>
                <TableCell className="text-right font-medium text-[12px] text-slate-700">{fmt(row.fyWeighted)}</TableCell>
                <TableCell className="text-center">
                  <button
                    onClick={() => onEdit(row)}
                    className="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-slate-100 transition-colors"
                    title="Edit Extension Override"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────
interface ExtensionRadarClientProps {
  rows: ExtensionForecastRow[];
  summary: ExtensionSummary;
}

export function ExtensionRadarClient({ rows: initialRows, summary }: ExtensionRadarClientProps) {
  const [rows, setRows] = useState<ExtensionForecastRow[]>(initialRows);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterBand, setFilterBand] = useState("all");
  const [filterCluster, setFilterCluster] = useState("all");

  const [selectedRow, setSelectedRow] = useState<ExtensionForecastRow | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  function handleEditRow(row: ExtensionForecastRow) {
    setSelectedRow(row);
    setOverrideOpen(true);
  }

  function handleRowUpdated(updated: ExtensionForecastRow) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  const clusters = useMemo(() => {
    const s = new Set(rows.map((r) => r.cluster).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const q = search.toLowerCase();
      if (q && !r.portCo.toLowerCase().includes(q) && !r.fund.toLowerCase().includes(q)) return false;
      if (filterLevel !== "all" && r.level !== filterLevel) return false;
      if (filterBand !== "all" && r.effectiveBand !== filterBand) return false;
      if (filterCluster !== "all" && r.cluster !== filterCluster) return false;
      return true;
    });
  }, [rows, search, filterLevel, filterBand, filterCluster]);

  const hasFilters = search || filterLevel !== "all" || filterBand !== "all" || filterCluster !== "all";

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 p-6 max-w-[1600px] mx-auto">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-violet-600 p-2 rounded-lg">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-[22px] font-bold text-slate-900">Extension Radar</h1>
              <span className="text-[11px] bg-violet-100 text-violet-700 font-semibold px-2 py-0.5 rounded-full border border-violet-200">
                AI Assisted + Human Intent
              </span>
            </div>
            <p className="text-[13px] text-slate-500 max-w-xl">
              Forecasts project extension likelihood for each portfolio client based on revenue pipeline,
              client tier, and manual PM/RM extension intent inputs.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Data month: <span className="font-semibold text-slate-600">Jul 2026</span>
              {" · "}
              <span className="text-slate-400">{rows.length} clients tracked</span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                    <Info className="h-4 w-4" />
                  </button>
                }
              />
              <TooltipContent className="max-w-[280px]">
                <div className="text-xs space-y-1">
                  <p className="font-semibold">How scores are computed</p>
                  <p>Client tier (25%) + Revenue trend (25%) + Forward weighted pipeline (30%) + FY booked revenue (20%). PM Manual Overrides take precedent.</p>
                  <p className="text-slate-400">Click the Edit icon on any client card to input extension intent.</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Summary bar */}
        <SummaryBar summary={summary} />

        {/* Risk / Opportunity highlights */}
        {summary.topRisks.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-[12px] font-bold text-red-700 uppercase tracking-wide">Top Extension Risks</span>
              </div>
              <div className="space-y-2">
                {summary.topRisks.slice(0, 3).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 bg-white/60 rounded-lg px-3 py-2">
                    <div>
                      <div className="text-[13px] font-semibold text-slate-800">{r.portCo}</div>
                      <div className="text-[11px] text-slate-400">{r.fund}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusArrow status={r.status} />
                      <span className="text-[12px] font-bold text-red-600">{r.effectiveScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-emerald-500" />
                <span className="text-[12px] font-bold text-emerald-700 uppercase tracking-wide">Highest Forward Pipeline</span>
              </div>
              <div className="space-y-2">
                {summary.topOpportunities.slice(0, 3).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 bg-white/60 rounded-lg px-3 py-2">
                    <div>
                      <div className="text-[13px] font-semibold text-slate-800">{r.portCo}</div>
                      <div className="text-[11px] text-slate-400">{r.fund}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-emerald-700">{fmt(r.forwardWeighted)}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters + view toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              id="extension-search"
              placeholder="Search PortCo or Fund…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-[12px] border-slate-200"
            />
          </div>

          <Select value={filterLevel} onValueChange={(v) => setFilterLevel(v ?? "all")}>
            <SelectTrigger className="h-8 text-[12px] w-[130px] border-slate-200">
              <SelectValue placeholder="All tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="Gold">Gold</SelectItem>
              <SelectItem value="Silver">Silver</SelectItem>
              <SelectItem value="Bronze">Bronze</SelectItem>
              <SelectItem value="Servicing">Servicing</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterBand} onValueChange={(v) => setFilterBand(v ?? "all")}>
            <SelectTrigger className="h-8 text-[12px] w-[140px] border-slate-200">
              <SelectValue placeholder="All bands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bands</SelectItem>
              <SelectItem value="VERY_LIKELY">Very Likely</SelectItem>
              <SelectItem value="LIKELY">Likely</SelectItem>
              <SelectItem value="UNCERTAIN">Uncertain</SelectItem>
              <SelectItem value="UNLIKELY">Unlikely</SelectItem>
            </SelectContent>
          </Select>

          {clusters.length > 1 && (
            <Select value={filterCluster} onValueChange={(v) => setFilterCluster(v ?? "all")}>
              <SelectTrigger className="h-8 text-[12px] w-[130px] border-slate-200">
                <SelectValue placeholder="All clusters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clusters</SelectItem>
                {clusters.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-[12px] text-slate-400 hover:text-slate-600"
              onClick={() => { setSearch(""); setFilterLevel("all"); setFilterBand("all"); setFilterCluster("all"); }}
            >
              Clear
            </Button>
          )}

          <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setView("cards")}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${view === "cards" ? "bg-white shadow-sm text-slate-800" : "text-slate-400 hover:text-slate-600"}`}
            >
              Cards
            </button>
            <button
              onClick={() => setView("table")}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${view === "table" ? "bg-white shadow-sm text-slate-800" : "text-slate-400 hover:text-slate-600"}`}
            >
              Table
            </button>
          </div>

          <span className="text-[11px] text-slate-400 ml-1">
            {filtered.length} of {rows.length}
          </span>
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Filter className="h-8 w-8 mb-3 opacity-40" />
            <p className="text-[14px] font-medium">No clients match your filters</p>
            <p className="text-[12px] mt-1">Try adjusting the search or filter options</p>
          </div>
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((row) => (
              <ExtensionCard key={row.id} row={row} onEdit={handleEditRow} />
            ))}
          </div>
        ) : (
          <ExtensionTable rows={filtered} onEdit={handleEditRow} />
        )}

        {/* Edit Override Modal */}
        <OverrideDialog
          row={selectedRow}
          open={overrideOpen}
          onOpenChange={setOverrideOpen}
          onUpdated={handleRowUpdated}
        />
      </div>
    </TooltipProvider>
  );
}
