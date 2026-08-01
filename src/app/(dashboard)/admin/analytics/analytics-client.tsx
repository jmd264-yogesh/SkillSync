"use client";

import { useState, useEffect } from "react";
import { GitFork, Lightbulb, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineRequestWithContext } from "@/server/services/pipeline.service";
import { PipelineAnalyticsClient } from "../resourcing/pipeline/analytics/pipeline-analytics-client";
import { PipelineLedger } from "../resourcing/pipeline/pipeline-client";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

// ─── Shared Premium Layout Components ──────────────────────────

export function SectionCard({
  title,
  description,
  children,
  className,
  flush,
  action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("bg-white rounded-xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden", className)}>
      <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div>
          <h3 className="font-bold text-sm text-slate-800 tracking-tight">{title}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className={cn("flex-1 min-w-0", flush ? "" : "px-6 pb-6")}>{children}</div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  icon,
  accent = "bg-indigo-50",
  tooltip,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  accent?: string;
  tooltip?: string;
}) {
  return (
    <TooltipProvider>
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:translate-y-[-2px] border-l-2 border-slate-200/50">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              {tooltip && (
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px] max-w-xs">{tooltip}</TooltipContent>
                </Tooltip>
              )}
            </div>
            <h3 className="text-2xl font-black text-slate-800 mt-1 tabular-nums leading-none tracking-tight">{value}</h3>
          </div>
          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border shadow-sm", accent)}>
            {icon}
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-3 font-medium">{sub}</p>
      </div>
    </TooltipProvider>
  );
}

// ─── Main Component ───────────────────────────────────────────

interface AnalyticsClientProps {
  requests: PipelineRequestWithContext[];
  benchCount: number;
}

type TabId = "timeline" | "board";

export function AnalyticsClient({ requests, benchCount }: AnalyticsClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("timeline");

  // Read initial tab state from search param
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as TabId;
      if (tab && ["timeline", "board"].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Premium Tab Bar */}
      <div className="flex justify-center pb-1">
        <div className="flex bg-slate-100 p-1 rounded-full shadow-inner relative">
          {[
            { id: "timeline", label: "Pipeline Flow", icon: GitFork },
            { id: "board", label: "Pipeline List", icon: Lightbulb },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                className={cn(
                  "relative flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer z-10",
                  isActive ? "text-primary font-bold shadow-sm bg-white" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-slate-400")} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === "timeline" && (
        <PipelineAnalyticsClient requests={requests} benchCount={benchCount} />
      )}
      {activeTab === "board" && (
        <PipelineLedger requests={requests} />
      )}
    </div>
  );
}
