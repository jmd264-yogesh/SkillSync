"use client";

import { useState } from "react";
import {
  GraduationCap, BookOpen, Code2, ClipboardCheck, Award, FolderKanban,
  TrendingUp, ChevronRight, Flame, Clock, Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import type { RecommendedPath, LearningStep } from "@/server/actions/learning-paths";

const LEVEL_NAMES: Record<number, string> = {
  0: "Unrated", 1: "Beginner", 2: "Basic", 3: "Intermediate", 4: "Advanced", 5: "Expert",
};

const STEP_CONFIG: Record<LearningStep["type"], { label: string; icon: React.ElementType; bg: string; text: string; dot: string }> = {
  course: { label: "Course", icon: BookOpen, bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
  practice: { label: "Practice", icon: Code2, bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-400" },
  assessment: { label: "Assessment", icon: ClipboardCheck, bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  certification: { label: "Certification", icon: Award, bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  project: { label: "Project", icon: FolderKanban, bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-400" },
};

const GAP_STYLE = (gap: number) => ({
  bar: gap >= 3 ? "bg-red-500" : gap === 2 ? "bg-amber-500" : "bg-indigo-500",
  badge: gap >= 3 ? "bg-red-50 text-red-700 border-red-200" : gap === 2 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-indigo-50 text-indigo-700 border-indigo-200",
  label: gap >= 3 ? "High Priority" : gap === 2 ? "Medium" : "Low",
});

interface LearningPathsClientProps {
  paths: RecommendedPath[];
  aiSummary?: string | null;
  aiConfigured?: boolean;
}

export function LearningPathsClient({ paths, aiSummary, aiConfigured }: LearningPathsClientProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(
    paths.length > 0 ? (paths[0]?.skillId ?? null) : null
  );

  if (paths.length === 0) {
    return (
      <div>
        <PageHeader title="Learning Paths" description="Personalized development roadmap based on your skill gaps" />
        <EmptyState
          icon={GraduationCap}
          title="All caught up!"
          description="You have no skill gaps at the moment. Keep validating skills to maintain your profile."
        />
      </div>
    );
  }

  const totalSteps = paths.reduce((sum, p) => sum + p.steps.length, 0);
  const criticalPaths = paths.filter((p) => p.gap >= 3).length;
  const selectedPath = paths.find((p) => p.skillId === selectedSkillId) ?? paths[0];

  return (
    <div>
      <PageHeader title="Learning Paths" description="Personalized development roadmap based on your skill gaps" />

      {/* AI Strategy Summary */}
      {aiSummary && (
        <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 flex gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1.5">AI Strategy</p>
            <p className="text-sm text-indigo-900 leading-relaxed">{aiSummary}</p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {[
          { label: "Skills to Develop", value: paths.length, icon: TrendingUp, bg: "bg-indigo-50", text: "text-primary" },
          { label: "Learning Steps", value: totalSteps, icon: BookOpen, bg: "bg-indigo-50", text: "text-primary" },
          { label: "High Priority", value: criticalPaths, icon: Flame, bg: "bg-indigo-50", text: "text-primary" },
        ].map((stat) => (
          <div key={stat.label} className="stat-card flex items-center gap-3.5">
            <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
              <stat.icon className={`h-5 w-5 ${stat.text}`} />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Skill cards list */}
        <div className="lg:col-span-1">
          <p className="text-md font-semibold text-slate-500 uppercase tracking-wider mb-3">Skills with Gaps</p>
          <div className="space-y-2">
            {paths.map((path) => {
              const style = GAP_STYLE(path.gap);
              const isSelected = selectedSkillId === path.skillId;
              return (
                <button
                  key={path.skillId}
                  onClick={() => setSelectedSkillId(path.skillId)}
                  className={`w-full text-left rounded-sm border-2 p-3.5 transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "border-primary bg-indigo-50/60 shadow-sm"
                      : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold text-md leading-tight truncate ${isSelected ? "text-primary" : "text-gray-900"}`}>
                        {path.skillName}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-sm text-muted-foreground">
                          L{path.currentLevel} → <span className="text-primary font-semibold">L{path.targetLevel}</span>
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.badge}`}>
                        {style.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{path.steps.length} steps</span>
                    </div>
                  </div>
                  {/* Gap bar */}
                  <div className="mt-2.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${style.bar} transition-all duration-500`}
                      style={{ width: `${(path.currentLevel / 5) * 100}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Recommended path */}
        <div className="lg:col-span-2">
          {selectedPath && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
              {/* Header */}
              <div className={`h-1 ${GAP_STYLE(selectedPath.gap).bar}`} />
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-gray-900">{selectedPath.skillName}</h2>
                    <Badge variant="secondary" className="mt-1 bg-slate-100 text-slate-600 border-0 text-xs font-medium rounded-md">
                      {selectedPath.category.charAt(0) + selectedPath.category.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <p className="text-[11px] text-muted-foreground">Current</p>
                        <p className="text-lg font-extrabold text-gray-900">L{selectedPath.currentLevel}</p>
                        <p className="text-[10px] text-muted-foreground">{LEVEL_NAMES[selectedPath.currentLevel]}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 mt-1" />
                      <div className="text-center">
                        <p className="text-[11px] text-muted-foreground">Target</p>
                        <p className="text-lg font-extrabold text-primary">L{selectedPath.targetLevel}</p>
                        <p className="text-[10px] text-muted-foreground">{LEVEL_NAMES[selectedPath.targetLevel]}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-1.5">
                    <span>Skill Progress</span>
                    <span>{Math.round((selectedPath.currentLevel / selectedPath.targetLevel) * 100)}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${(selectedPath.currentLevel / selectedPath.targetLevel) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  Recommended Path · {selectedPath.steps.length} Steps
                </p>
                <div className="relative">
                  <div className="absolute left-[19px] top-5 bottom-5 w-0.5 bg-slate-100" />
                  <div className="space-y-3">
                    {selectedPath.steps.map((step) => {
                      const config = STEP_CONFIG[step.type];
                      return (
                        <div key={step.order} className="flex items-start gap-3.5 group">
                          <div className={`relative z-10 h-10 w-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
                            <config.icon className={`h-4 w-4 ${config.text}`} />
                          </div>
                          <div className="flex-1 min-w-0 pt-1 pb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-gray-900">{step.title}</span>
                              <Badge variant="secondary" className={`${config.bg} ${config.text} border-0 text-[10px] font-bold rounded-md`}>
                                {config.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                            <span className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />{step.duration}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-300 pt-2 shrink-0">{step.order}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
