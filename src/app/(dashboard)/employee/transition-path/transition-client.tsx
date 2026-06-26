"use client";

import { useState, useTransition } from "react";
import {
  ArrowUpRight, Briefcase, CheckCircle2, TrendingUp, XCircle, Target,
  AlertTriangle, ChevronRight, Clock, Search, ChevronLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { getTransitionGap, type TransitionGapResult } from "@/server/actions/transition-path";

interface Designation {
  id: string;
  name: string;
  level: number;
}

interface TransitionClientProps {
  designations: Designation[];
}

const PRIORITY_CONFIG = {
  Critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  High: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  Medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  None: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
} as const;

const STATUS_CONFIG = {
  met: { icon: CheckCircle2, dot: "bg-emerald-400", label: "Met", bg: "bg-emerald-50", text: "text-emerald-700" },
  partial: { icon: TrendingUp, dot: "bg-amber-400", label: "In Progress", bg: "bg-amber-50", text: "text-amber-700" },
  missing: { icon: XCircle, dot: "bg-red-400", label: "Not Started", bg: "bg-red-50", text: "text-red-700" },
} as const;

const PAGE_SIZE = 8;

function ReadinessRing({ percentage }: { percentage: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 70 ? "#10b981" : percentage >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-extrabold text-gray-900">{percentage}%</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ready</span>
      </div>
    </div>
  );
}

export function TransitionClient({ designations }: TransitionClientProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [result, setResult] = useState<TransitionGapResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "met" | "partial" | "missing">("all");
  const [page, setPage] = useState(1);

  function handleSelect(id: string) {
    setSelectedId(id);
    setSearch("");
    setStatusFilter("all");
    setPage(1);
    if (!id) { setResult(null); return; }
    startTransition(async () => {
      const data = await getTransitionGap(id);
      setResult(data);
    });
  }

  const filteredItems = result?.items.filter((item) => {
    const matchSearch = item.skillName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || item.status === statusFilter;
    return matchSearch && matchStatus;
  }) ?? [];

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginated = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Designation Transition Path" description="Understand what it takes to move to a target role" />

      {/* Designation selector */}
      <div className="mb-7">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Select Target Designation</p>
        <div className="flex flex-wrap gap-2">
          {designations.map((d) => (
            <button
              key={d.id}
              onClick={() => handleSelect(selectedId === d.id ? "" : d.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                selectedId === d.id
                  ? "border-primary bg-indigo-50 text-primary shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-primary hover:bg-indigo-50/40"
              }`}
            >
              <div className={`h-6 w-6 rounded-md flex items-center justify-center ${selectedId === d.id ? "bg-indigo-200" : "bg-slate-100"}`}>
                <span className={`text-[10px] font-extrabold ${selectedId === d.id ? "text-primary" : "text-slate-600"}`}>L{d.level}</span>
              </div>
              <Briefcase className="h-3.5 w-3.5" />
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {!selectedId && (
        <EmptyState icon={ArrowUpRight} title="Select a target designation"
          description="Choose a role above to see the skill gap and your readiness score." />
      )}

      {isPending && (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-2 border-indigo-200 border-t-primary animate-spin" />
            <span className="text-sm font-medium text-muted-foreground">Computing transition gap…</span>
          </div>
        </div>
      )}

      {!isPending && result && (
        <div className="space-y-6">
          {/* Transition banner */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Briefcase className="h-4 w-4 text-primary" />
              {result.currentDesignation}
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <Briefcase className="h-4 w-4 text-primary" />
              {result.targetDesignation}
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {result.estimatedMonthsMin}–{result.estimatedMonthsMax} months estimated
            </div>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card flex flex-col items-center justify-center py-6">
              <ReadinessRing percentage={result.readinessScore} />
            </div>

            <div className="lg:col-span-3 grid grid-cols-3 gap-4">
              {[
                { label: "Skills Met", value: result.skillsMet, icon: CheckCircle2, bg: "bg-indigo-50", text: "text-primary", bar: "bg-emprimary" },
                { label: "Gaps Remaining", value: result.totalSkills - result.skillsMet, icon: AlertTriangle, bg: "bg-indigo-50", text: "text-primary", bar: "bg-primary" },
                { label: "Total Required", value: result.totalSkills, icon: Target, bg: "bg-indigo-50", text: "text-primary", bar: "bg-primary" },
              ].map((stat) => (
                <div key={stat.label} className="stat-card">
                  <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                    <stat.icon className={`h-5 w-5 ${stat.text}`} />
                  </div>
                  <p className="text-2xl font-extrabold text-gray-900">{stat.value}</p>
                  <p className="text-md text-muted-foreground mt-0.5">{stat.label}</p>
                  <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${stat.bar} transition-all duration-700`}
                      style={{ width: `${result.totalSkills > 0 ? (stat.value / result.totalSkills) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search skills…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 h-9 rounded-lg text-sm"
              />
            </div>
            <div className="flex rounded-lg border border-input overflow-hidden">
              {(["all", "met", "partial", "missing"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === s ? "bg-primary text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {s === "all" ? "All" : s === "met" ? "Met" : s === "partial" ? "In Progress" : "Not Started"}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filteredItems.length} of {result.items.length} skills</span>
          </div>

          {/* Gap cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger-children">
            {paginated.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status];
              const priorityCfg = PRIORITY_CONFIG[item.priority];
              const StatusIcon = statusCfg.icon;
              return (
                <div key={item.skillId} className={`rounded-xl border p-4 bg-white hover:shadow-sm transition-all ${statusCfg.bg}/30 ${
                  item.status === "met" ? "border-emerald-200" : item.status === "partial" ? "border-amber-200" : "border-slate-200"
                }`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-900 truncate">{item.skillName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className={`${priorityCfg.bg} ${priorityCfg.text} ${priorityCfg.border} text-[10px] font-bold rounded-md border`}>
                            {item.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`${statusCfg.bg} ${statusCfg.text} border-0 text-[10px] font-semibold rounded-md shrink-0 flex items-center gap-1`}>
                      <StatusIcon className="h-2.5 w-2.5" />{statusCfg.label}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-14 shrink-0">Current</span>
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(item.currentLevel / 5) * 100}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-4 text-right">{item.currentLevel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-14 shrink-0">Required</span>
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-secondary rounded-full" style={{ width: `${(item.targetLevel / 5) * 100}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-4 text-right">{item.targetLevel}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8 w-8 rounded-lg border border-input flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-8 w-8 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      page === p ? "bg-indigo-600 text-white border-indigo-600" : "border-input text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 w-8 rounded-lg border border-input flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
