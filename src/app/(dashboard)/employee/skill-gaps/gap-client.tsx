"use client";

import { useState } from "react";
import {
  BarChart3, Target, AlertTriangle, CheckCircle2, XCircle, TrendingUp, Building2, Briefcase,
  ChevronLeft, ChevronRight, Search, Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

interface GapItem {
  skillId: string;
  skillName: string;
  category: string;
  targetLevel: number;
  currentLevel: number;
  gap: number;
  status: "met" | "partial" | "missing";
  source: "COE" | "Designation" | "Both";
}

interface GapAnalysis {
  items: GapItem[];
  readiness: { met: number; partial: number; missing: number; total: number; percentage: number };
  employeeName: string;
  coeName: string | null;
  designationName: string | null;
}

const statusConfig = {
  met: { label: "Met", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400" },
  partial: { label: "In Progress", icon: TrendingUp, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400" },
  missing: { label: "Not Started", icon: XCircle, bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-400" },
};

const PAGE_SIZE = 8;

function ReadinessRing({ percentage }: { percentage: number }) {
  const r = 62;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 70 ? "#10b981" : percentage >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-44 h-44 -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-extrabold text-gray-900">{percentage}%</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Readiness</span>
      </div>
    </div>
  );
}

interface GapClientProps {
  analysis: GapAnalysis | null;
  aiNarrative?: string | null;
  aiConfigured?: boolean;
}

export function GapClient({ analysis, aiNarrative, aiConfigured }: GapClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "met" | "partial" | "missing">("all");
  const [page, setPage] = useState(1);

  if (!analysis || analysis.items.length === 0) {
    return (
      <div>
        <PageHeader title="Skill Gap Assessment" description="Compare your current skills against your target profile" />
        <EmptyState icon={BarChart3} title="No gap analysis available"
          description="Gap analysis requires your COE and/or designation to have mapped skills. Contact your admin." />
      </div>
    );
  }

  const { items, readiness } = analysis;

  const filtered = items.filter((item) => {
    const matchSearch = item.skillName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Skill Gap Assessment" description="Compare your validated skills against your target profile" />

      {/* AI Narrative card */}
      {aiNarrative && (
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 flex gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1.5">AI Analysis</p>
            <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-line">{aiNarrative}</p>
          </div>
        </div>
      )}
      {aiConfigured && !aiNarrative && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-slate-400" />
          <p className="text-xs text-slate-500">AI analysis unavailable - no skill gaps found or rate limit reached.</p>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Readiness ring */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card flex flex-col items-center justify-center py-8">
          <ReadinessRing percentage={readiness.percentage} />
          <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
            {analysis.coeName && (
              <Badge variant="secondary" className="rounded-lg bg-indigo-50 text-primary py-4 px-6 border-0 font-semibold text-sm">
                <Building2 className="h-3 w-3 mr-1" />{analysis.coeName}
              </Badge>
            )}
            {analysis.designationName && (
              <Badge variant="secondary" className="rounded-lg bg-violet-50 text-primary py-4 px-6 border-0 font-semibold text-sm">
                <Briefcase className="h-3 w-3 mr-1" />{analysis.designationName}
              </Badge>
            )}
          </div>
        </div>

        {/* Stat cards */}
        <div className="lg:col-span-2 grid grid-cols-3 gap-4">
          {[
            { label: "Skills Met", value: readiness.met, icon: CheckCircle2, bg: "bg-indigo-50", text: "text-primary", bar: "bg-primary" },
            { label: "In Progress", value: readiness.partial, icon: TrendingUp, bg: "bg-indigo-50", text: "text-primary", bar: "bg-primary" },
            { label: "Not Started", value: readiness.missing, icon: AlertTriangle, bg: "bg-indigo-50", text: "text-primary", bar: "bg-primary" },
          ].map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`h-5 w-5 ${stat.text}`} />
              </div>
              <p className="text-4xl font-extrabold text-gray-900">{stat.value}</p>
              <p className="text-lg font-semibold text-muted-foreground mt-2">{stat.label}</p>
              <p className="text-md text-muted-foreground">of {readiness.total} target skills</p>
              <div className="mt-5 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${stat.bar} transition-all duration-700`}
                  style={{ width: `${readiness.total > 0 ? (stat.value / readiness.total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
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
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {items.length} skills</span>
      </div>

      {/* Gap cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger-children">
        {paginated.map((item) => {
          const config = statusConfig[item.status];
          const StatusIcon = config.icon;
          const gapSize = item.gap;

          return (
            <div
              key={item.skillId}
              className={`rounded-xl border ${config.border} ${config.bg}/40 bg-white p-4 hover:shadow-sm transition-all duration-150`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Gap indicator */}
                 
                  <div className="min-w-0">
                    <p className="font-bold text-md text-primary truncate">{item.skillName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] border-slate-200 rounded-md font-medium">{item.source}</Badge>
                      <span className="text-[10px] text-muted-foreground">{item.category}</span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className={`${config.bg} ${config.text} ${config.border} text-[10px] font-semibold rounded-md shrink-0 flex items-center gap-1`}>
                  <StatusIcon className="h-2.5 w-2.5" />{config.label}
                </Badge>
              </div>

              {/* Dual progress bars */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-14 shrink-0">Current</span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-700"
                      style={{ width: `${(item.currentLevel / 5) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-4 text-right">{item.currentLevel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-14 shrink-0">Target</span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-secondary rounded-full transition-all duration-700"
                      style={{ width: `${(item.targetLevel / 5) * 100}%` }} />
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
        <div className="flex items-center justify-between mt-5">
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
                  page === p ? "bg-primary text-white border-primary" : "border-input text-slate-600 hover:bg-slate-50"
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
  );
}
