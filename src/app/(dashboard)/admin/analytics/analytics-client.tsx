"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
} from "recharts";
import {
  Users,
  Award,
  Briefcase,
  Network,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  Percent,
  Search,
  Filter,
  RefreshCw,
  Info,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface Employee {
  id: string;
  name: string;
  coeId: string | null;
  designationId: string | null;
  coe: {
    name: string;
    coeSkills: { skillId: string; targetCompetency: number }[];
  } | null;
  designation: {
    name: string;
    designationSkills: { skillId: string; targetCompetency: number }[];
  } | null;
  employeeSkills: { skillId: string; validatedLevel: number | null; skill: { name: string } }[];
  allocations: { allocation: number; project: { name: string }; startDate: any; endDate: any }[];
}

interface WorkforceNarrativeResult {
  headline: string;
  summary: string;
  urgentActions: string[];
  positiveSignal: string;
}

interface AnalyticsClientProps {
  employees: Employee[];
  coes: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  recentMappings: {
    id: string;
    employeeName: string;
    skillName: string;
    status: string;
    level: number;
  }[];
  totalProjects: number;
  aiNarrative?: WorkforceNarrativeResult | null;
  aiConfigured?: boolean;
}

const PRIMARY = "#19105b";
const SECONDARY = "#ff6196";
const PRIMARY_SOFT = "#EEF0F8";
const SECONDARY_SOFT = "#fff0f5";
const pieFills = [PRIMARY, SECONDARY, "#94a3b8", "#3b82f6", "#f59e0b", "#10b981"];

function computeEmployeeReadiness(emp: Employee): number {
  const targetMap = new Map<string, number>();
  for (const cs of emp.coe?.coeSkills ?? []) {
    targetMap.set(cs.skillId, Math.max(targetMap.get(cs.skillId) ?? 0, cs.targetCompetency));
  }
  for (const ds of emp.designation?.designationSkills ?? []) {
    targetMap.set(ds.skillId, Math.max(targetMap.get(ds.skillId) ?? 0, ds.targetCompetency));
  }
  if (targetMap.size === 0) return 0;
  
  const currentMap = new Map<string, number>();
  for (const es of emp.employeeSkills) {
    currentMap.set(es.skillId, es.validatedLevel ?? 0);
  }
  
  let met = 0;
  for (const [skillId, target] of targetMap) {
    if ((currentMap.get(skillId) ?? 0) >= target) met++;
  }
  return Math.round((met / targetMap.size) * 100);
}

function SectionCard({
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
      <div className={cn("flex-1", flush ? "" : "px-6 pb-6")}>{children}</div>
    </div>
  );
}

export function AnalyticsClient({
  employees,
  coes,
  designations,
  recentMappings,
  totalProjects,
  aiNarrative,
  aiConfigured,
}: AnalyticsClientProps) {
  type TabId = "skills" | "resourcing" | "forecasting";
  const [activeTab, setActiveTab] = useState<TabId>("skills");
  
  // PowerBI Filter State
  const [selectedCoe, setSelectedCoe] = useState<string>("all");
  const [selectedDesignation, setSelectedDesignation] = useState<string>("all");
  const [utilizationFilter, setUtilizationFilter] = useState<string>("all");
  const [searchSkill, setSearchSkill] = useState<string>("-");

  const actualSearchSkill = searchSkill === "-" ? "" : searchSkill;

  // Real-time Dynamic Slicing & Calculations
  const filteredEmployees = employees.filter((emp) => {
    const matchCoe = selectedCoe === "all" || emp.coe?.name === selectedCoe;
    const matchDesignation = selectedDesignation === "all" || emp.designation?.name === selectedDesignation;
    
    const utilization = emp.allocations.reduce((sum, a) => sum + a.allocation, 0);
    let matchUtilization = true;
    if (utilizationFilter === "bench") matchUtilization = utilization === 0;
    else if (utilizationFilter === "low") matchUtilization = utilization > 0 && utilization < 50;
    else if (utilizationFilter === "medium") matchUtilization = utilization >= 50 && utilization < 80;
    else if (utilizationFilter === "high") matchUtilization = utilization >= 80 && utilization <= 100;
    else if (utilizationFilter === "overallocated") matchUtilization = utilization > 100;

    let matchSkill = true;
    if (actualSearchSkill.trim() !== "") {
      matchSkill = emp.employeeSkills.some((es) =>
        es.skill.name.toLowerCase().includes(actualSearchSkill.toLowerCase())
      );
    }

    return matchCoe && matchDesignation && matchUtilization && matchSkill;
  });

  const totalEmployeesCount = filteredEmployees.length;

  // Compute readiness stats
  const readinessScores = filteredEmployees.map((emp) => ({
    name: emp.name,
    readiness: computeEmployeeReadiness(emp),
    coeName: emp.coe?.name ?? "General",
  }));

  const averageReadiness =
    readinessScores.length > 0
      ? Math.round(readinessScores.reduce((s, e) => s + e.readiness, 0) / readinessScores.length)
      : 0;

  const employeesWithNoGaps = readinessScores.filter((e) => e.readiness === 100).length;

  const readinessBands = {
    low: readinessScores.filter((e) => e.readiness < 40).length,
    medium: readinessScores.filter((e) => e.readiness >= 40 && e.readiness <= 70).length,
    high: readinessScores.filter((e) => e.readiness > 70).length,
  };

  // Compute utilization stats
  let totalAllocatedWork = 0;
  const utilizationBands = {
    bench: 0,
    low: 0,
    medium: 0,
    high: 0,
    overallocated: 0,
  };

  const coeUtilizationMap = new Map<string, { totalAlloc: number; count: number }>();
  const coeReadinessMap = new Map<string, number[]>();
  const benchList: { name: string; coeName: string; utilization: number; topSkills: string[] }[] = [];

  for (const emp of filteredEmployees) {
    const utilization = emp.allocations.reduce((sum, a) => sum + a.allocation, 0);
    totalAllocatedWork += utilization;

    if (utilization === 0) utilizationBands.bench++;
    else if (utilization < 50) utilizationBands.low++;
    else if (utilization < 80) utilizationBands.medium++;
    else if (utilization <= 100) utilizationBands.high++;
    else utilizationBands.overallocated++;

    if (emp.coe) {
      // Utilization
      const existingUtil = coeUtilizationMap.get(emp.coe.name) ?? { totalAlloc: 0, count: 0 };
      existingUtil.totalAlloc += utilization;
      existingUtil.count++;
      coeUtilizationMap.set(emp.coe.name, existingUtil);

      // Readiness
      const score = computeEmployeeReadiness(emp);
      const existingReadiness = coeReadinessMap.get(emp.coe.name) ?? [];
      existingReadiness.push(score);
      coeReadinessMap.set(emp.coe.name, existingReadiness);
    }

    if (utilization < 50) {
      const topSkills = [...emp.employeeSkills]
        .sort((a, b) => (b.validatedLevel ?? 0) - (a.validatedLevel ?? 0))
        .slice(0, 3)
        .map((es) => `${es.skill.name} (L${es.validatedLevel})`);

      benchList.push({
        name: emp.name,
        coeName: emp.coe?.name ?? "General",
        utilization,
        topSkills,
      });
    }
  }

  const averageUtilization = totalEmployeesCount > 0 ? Math.round(totalAllocatedWork / totalEmployeesCount) : 0;

  const coeUtilizationData = Array.from(coeUtilizationMap.entries()).map(([name, data]) => ({
    name,
    utilization: data.count > 0 ? Math.round(data.totalAlloc / data.count) : 0,
  }));

  const coeReadinessData = Array.from(coeReadinessMap.entries()).map(([name, scores]) => ({
    name,
    readiness: scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0,
  })).sort((a, b) => b.readiness - a.readiness);

  // Group headcount charts
  const coeHeadcountData = coes.map((c) => ({
    name: c.name,
    count: filteredEmployees.filter((e) => e.coe?.name === c.name).length,
  }));

  const designationHeadcountData = designations.map((d) => ({
    name: d.name,
    count: filteredEmployees.filter((e) => e.designation?.name === d.name).length,
  }));

  // Resourcing distribution bars
  const utilizationBandData = [
    { name: "Bench (0%)", count: utilizationBands.bench, fill: SECONDARY },
    { name: "Low (1-49%)", count: utilizationBands.low, fill: "#f59e0b" },
    { name: "Medium (50-79%)", count: utilizationBands.medium, fill: "#3b82f6" },
    { name: "High (80-100%)", count: utilizationBands.high, fill: PRIMARY },
    { name: "Over-allocated (>100%)", count: utilizationBands.overallocated, fill: "#ef4444" },
  ];

  // Resource Roll-off & Capacity Burndown
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthsList = Array.from({ length: 6 }, (_, idx) => {
    const d = new Date(currentYear, currentMonth + idx, 1);
    return {
      name: d.toLocaleString("default", { month: "short", year: "2-digit" }),
      monthStart: new Date(d.getFullYear(), d.getMonth(), 1),
      monthEnd: new Date(d.getFullYear(), d.getMonth() + 1, 0),
    };
  });

  const totalAllocatedFTECurrent = filteredEmployees.reduce((sum, emp) => {
    return sum + (emp.allocations.reduce((s, a) => s + a.allocation, 0) / 100);
  }, 0);

  const burndownData = monthsList.map((month, idx) => {
    if (idx === 0) {
      return { period: "Current", committedFTEs: Math.round(totalAllocatedFTECurrent * 10) / 10 };
    }
    
    let activeFTE = 0;
    for (const emp of filteredEmployees) {
      for (const alloc of emp.allocations) {
        const allocEnd = alloc.endDate ? new Date(alloc.endDate) : null;
        const allocStart = alloc.startDate ? new Date(alloc.startDate) : null;
        
        let isActive = true;
        if (allocEnd && allocEnd < month.monthStart) {
          isActive = false;
        }
        if (allocStart && allocStart > month.monthEnd) {
          isActive = false;
        }
        
        if (isActive) {
          activeFTE += alloc.allocation / 100;
        }
      }
    }
    return {
      period: month.name,
      committedFTEs: Math.round(activeFTE * 10) / 10,
    };
  });

  // Burnout Risk list (Utilization > 100%)
  const burnoutRiskList = filteredEmployees
    .map((emp) => {
      const utilization = emp.allocations.reduce((sum, a) => sum + a.allocation, 0);
      return {
        name: emp.name,
        coeName: emp.coe?.name ?? "General",
        utilization,
        projectCount: emp.allocations.length,
      };
    })
    .filter((emp) => emp.utilization > 100)
    .sort((a, b) => b.utilization - a.utilization);

  // Upcoming Roll-offs (Allocations ending in the future)
  const upcomingRollOffs = filteredEmployees
    .flatMap((emp) =>
      emp.allocations.map((alloc) => {
        const endDate = alloc.endDate ? new Date(alloc.endDate) : null;
        let daysLeft = 0;
        if (endDate) {
          const diffTime = endDate.getTime() - now.getTime();
          daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        return {
          employeeName: emp.name,
          coeName: emp.coe?.name ?? "General",
          projectName: alloc.project.name,
          allocation: alloc.allocation,
          endDate,
          daysLeft,
        };
      })
    )
    .filter((alloc) => alloc.endDate && alloc.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 10);

  // Scatter Plot Data (Talent Quadrant Matrix)
  const scatterData = filteredEmployees.map((emp) => {
    const readiness = computeEmployeeReadiness(emp);
    const utilization = emp.allocations.reduce((sum, a) => sum + a.allocation, 0);
    return {
      name: emp.name,
      readiness,
      utilization,
      skillsCount: emp.employeeSkills.length,
      coeName: emp.coe?.name ?? "General",
    };
  });

  function handleResetFilters() {
    setSelectedCoe("all");
    setSelectedDesignation("all");
    setUtilizationFilter("all");
    setSearchSkill("-");
  }

  const isFiltered =
    selectedCoe !== "all" ||
    selectedDesignation !== "all" ||
    utilizationFilter !== "all" ||
    searchSkill !== "-";

  return (
    <div className="space-y-6">

      {/* AI Workforce Intelligence Brief */}
      {aiConfigured && aiNarrative && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 rounded-lg bg-indigo-600 p-2">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">AI Workforce Intelligence</span>
                <span className="text-[10px] text-indigo-400">· Powered by Gemini</span>
              </div>
              <p className="text-sm font-bold text-indigo-900 leading-snug mb-1.5">{aiNarrative.headline}</p>
              <p className="text-xs text-indigo-800/80 leading-relaxed mb-3">{aiNarrative.summary}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Priority Actions</span>
                  </div>
                  <ul className="space-y-1">
                    {aiNarrative.urgentActions.map((action, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="text-xs text-slate-700">{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-800">{aiNarrative.positiveSignal}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PowerBI Top Slicers & Filters Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Report Slicers</h4>
          </div>
          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* COE Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Center of Excellence</label>
            <select
              value={selectedCoe}
              onChange={(e) => setSelectedCoe(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer text-slate-700 font-medium"
            >
              <option value="all">All COEs</option>
              {coes.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Designation Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Designation Track</label>
            <select
              value={selectedDesignation}
              onChange={(e) => setSelectedDesignation(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer text-slate-700 font-medium"
            >
              <option value="all">All Designations</option>
              {designations.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Resourcing Status Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Allocation Status</label>
            <select
              value={utilizationFilter}
              onChange={(e) => setUtilizationFilter(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer text-slate-700 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="bench">Benched (0%)</option>
              <option value="low">Low Allocation (&lt;50%)</option>
              <option value="medium">Medium Allocation (50-79%)</option>
              <option value="high">Optimal (80-100%)</option>
              <option value="overallocated">Over-allocated (&gt;100%)</option>
            </select>
          </div>

          {/* Skill Filter Search */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Search by Skill</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="e.g. React, Docker..."
                value={actualSearchSkill}
                onChange={(e) => setSearchSkill(e.target.value || "-")}
                className="pl-8 h-9 rounded-lg text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Dashboard Cards (Dynamic & Sliced) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI: Filtered headcount */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Filtered headcount</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1 tabular-nums">{totalEmployeesCount}</h3>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-medium">
            Representing {Math.round((totalEmployeesCount / Math.max(1, employees.length)) * 100)}% of total staff
          </p>
        </div>

        {/* KPI: Average Readiness */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Skill readiness</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1 tabular-nums">{averageReadiness}%</h3>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50">
              <Award className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", averageReadiness >= 75 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
              Target: 75%
            </span>
            <span className="text-[10px] text-slate-400">
              {averageReadiness >= 75 ? "Target Achieved" : `${75 - averageReadiness}% deficit`}
            </span>
          </div>
        </div>

        {/* KPI: Capacity Utilization */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Capacity Util.</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1 tabular-nums">{averageUtilization}%</h3>
            </div>
            <div className="p-2 rounded-lg bg-pink-50">
              <Percent className="h-4 w-4 text-pink-600" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", averageUtilization >= 80 ? "bg-emerald-50 text-emerald-700" : averageUtilization >= 60 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700")}>
              Optimal: 80%
            </span>
            <span className="text-[10px] text-slate-400">
              {averageUtilization >= 80 ? "Fully Loaded" : `${80 - averageUtilization}% available`}
            </span>
          </div>
        </div>

        {/* KPI: Bench Count */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Benched Resources</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1 tabular-nums">{utilizationBands.bench}</h3>
            </div>
            <div className="p-2 rounded-lg bg-amber-50">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-medium">
            {utilizationBands.bench} employees at 0% project allocation
          </p>
        </div>
      </div>

      {/* Premium Tab Bar */}
      <div className="flex justify-center border-b border-slate-200 pb-1">
        <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200/80 shadow-inner relative">
          {[
            { id: "skills", label: "Skill & Readiness Intelligence", icon: Award },
            { id: "resourcing", label: "Resource Utilization & Bench Matrix", icon: Users },
            { id: "forecasting", label: "Workload & Capacity Forecasting", icon: Briefcase },
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
      {activeTab === "skills" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* COE Competency Gaps List */}
          <SectionCard
            title="COE Target Gaps & Deficits"
            description="Competency analysis ranked by skill readiness"
            className="md:col-span-2"
          >
            <div className="space-y-4 pt-4">
              {coeReadinessData.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-12">No data available for the active filters</p>
              ) : (
                coeReadinessData.map((item, i) => {
                  const val = item.readiness;
                  const color = val >= 70 ? "#10b981" : val >= 40 ? "#f59e0b" : "#ef4444";
                  
                  return (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-300 font-bold">{String(i + 1).padStart(2, "0")}</span>
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold tabular-nums" style={{ color }}>{val}%</span>
                          <span className="text-[9px] text-slate-400 font-medium">readiness</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden relative">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${val}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          {/* Skill Readiness snapshot */}
          <SectionCard
            title="Skill Bands Breakdown"
            description="Workforce count by target level compliance"
          >
            <div className="flex flex-col items-center pt-4">
              {/* Radial gauge */}
              <div className="relative inline-flex items-center justify-center mb-6">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="52" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                  <circle
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke={PRIMARY}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 52}
                    strokeDashoffset={2 * Math.PI * 52 - (averageReadiness / 100) * (2 * Math.PI * 52)}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-extrabold text-gray-900">{averageReadiness}%</span>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Avg Org Readiness</span>
                </div>
              </div>

              {/* Band list */}
              <div className="w-full space-y-2">
                {[
                  { label: "Optimal / High (≥70%)", count: readinessBands.high, bg: "bg-emerald-50 text-emerald-700 border-emerald-100" },
                  { label: "Developing / Medium (40-69%)", count: readinessBands.medium, bg: "bg-amber-50 text-amber-700 border-amber-100" },
                  { label: "Critical Gaps / Low (<40%)", count: readinessBands.low, bg: "bg-rose-50 text-rose-700 border-rose-100" },
                ].map((band, idx) => (
                  <div
                    key={idx}
                    className={cn("flex justify-between items-center rounded-lg px-3 py-2 border text-xs font-semibold", band.bg)}
                  >
                    <span>{band.label}</span>
                    <span className="tabular-nums">{band.count} employees</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* COE Competency Radar Comparison */}
          <SectionCard
            title="COE Competency Radar Comparison"
            description="Average skill readiness percentage by Center of Excellence"
          >
            <div className="h-[260px] flex items-center justify-center">
              {coeReadinessData.length === 0 ? (
                <p className="text-xs text-slate-400">No data available</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart outerRadius={70} data={coeReadinessData}>
                    <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="name" fontSize={9} tick={{ fill: "#475569", fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={8} />
                    <Radar
                      name="Readiness %"
                      dataKey="readiness"
                      stroke={PRIMARY}
                      fill={PRIMARY}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "10px",
                        border: "none",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        fontSize: "11px",
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>

          {/* Headcount by Designation */}
          <SectionCard
            title="Slices: Headcount by Designation"
            description="Employees grouped by designation level"
            className="md:col-span-2"
          >
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={designationHeadcountData.filter(d => d.count > 0)}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 40, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={130}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(25,16,91,0.02)" }}
                    contentStyle={{
                      borderRadius: "10px",
                      border: "none",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      fontSize: "11px",
                    }}
                  />
                  <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

        </div>
      ) : activeTab === "resourcing" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Utilization Distribution */}
          <SectionCard
            title="Capacity Allocation Distribution"
            description="Headcount by allocation range (Target threshold marked at 80% utilization)"
            className="md:col-span-2"
          >
            <div className="h-[280px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationBandData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(25,16,91,0.02)" }}
                    contentStyle={{
                      borderRadius: "10px",
                      border: "none",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {utilizationBandData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Allocation snapshot card */}
          <SectionCard
            title="Resourcing KPI Balance"
            description="Workforce billability analysis"
          >
            <div className="flex flex-col items-center justify-center pt-4 h-full">
              <div className="relative inline-flex items-center justify-center mb-6">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="52" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                  <circle
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke={SECONDARY}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 52}
                    strokeDashoffset={
                      2 * Math.PI * 52 -
                      ((utilizationBands.bench + utilizationBands.low) / Math.max(1, totalEmployeesCount)) * (2 * Math.PI * 52)
                    }
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center text-center">
                  <span className="text-3xl font-black text-rose-600 tabular-nums">
                    {Math.round(((utilizationBands.bench + utilizationBands.low) / Math.max(1, totalEmployeesCount)) * 100)}%
                  </span>
                  <span className="text-[8px] font-bold text-rose-500 uppercase tracking-wider">Unutilized / Bench</span>
                </div>
              </div>

              <div className="w-full space-y-2">
                <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-slate-50 border border-slate-200/50 text-xs">
                  <span className="font-semibold text-slate-600">Optimal (80-100% Load)</span>
                  <span className="font-bold text-slate-800">{utilizationBands.high} resources</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-rose-50 border border-rose-100 text-xs">
                  <span className="font-semibold text-rose-700">Total Benched (0% Load)</span>
                  <span className="font-bold text-rose-700">{utilizationBands.bench} resources</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Utilization rates by COE */}
          <SectionCard
            title="Avg Utilization by COE"
            description="COE allocation rate mapped against target optimal load (80%)"
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coeUtilizationData} margin={{ top: 8, right: 16, left: 10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis fontSize={9} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "10px",
                      border: "none",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      fontSize: "11px",
                    }}
                  />
                  <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" label={{ value: "Optimal Target (80%)", fill: "#10b981", fontSize: 9, position: "top" }} />
                  <Bar dataKey="utilization" fill={PRIMARY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Bench Resource Table */}
          <SectionCard
            title="Available Bench Resource Directory"
            description="List of resources with capacity available for immediate allocation (<50% utilization)"
            className="md:col-span-2"
            flush
          >
            <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                    <th className="py-2 px-4">Resource</th>
                    <th className="py-2 px-4">COE</th>
                    <th className="py-2 px-4">Allocation</th>
                    <th className="py-2 px-4">Core Approved Competencies</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {benchList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        Excellent! No under-utilized resources found in this query.
                      </td>
                    </tr>
                  ) : (
                    benchList.map((emp, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-slate-800">{emp.name}</td>
                        <td className="py-2.5 px-4 text-slate-600">{emp.coeName}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full font-bold",
                              emp.utilization === 0
                                ? "bg-rose-50 text-rose-700 border border-rose-100"
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                            )}
                          >
                            {emp.utilization}% Allocated
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex gap-1 flex-wrap">
                            {emp.topSkills.length > 0 ? (
                              emp.topSkills.map((sk, idx) => (
                                <span
                                  key={idx}
                                  className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 border border-slate-200/50 text-[10px]"
                                >
                                  {sk}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">No skills mapped</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Talent Positioning Quadrants (Skills vs. Capacity workload)"
            description="Correlation of individual employee readiness compliance (X-axis) and project allocation percentage (Y-axis)"
            className="md:col-span-3 mt-6"
          >
            <div className="space-y-6 pt-4">
              {/* Chart */}
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" dataKey="readiness" name="Readiness" unit="%" fontSize={10} domain={[0, 100]} tickLine={false} axisLine={false} />
                    <YAxis type="number" dataKey="utilization" name="Utilization" unit="%" fontSize={10} domain={[0, 150]} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{
                        borderRadius: "10px",
                        border: "none",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        fontSize: "12px",
                      }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length && payload[0]) {
                          const data = payload[0].payload;
                          if (!data) return null;
                          return (
                            <div className="bg-white p-3 border border-slate-100 rounded-lg shadow-md text-xs space-y-1">
                              <p className="font-bold text-slate-800">{data.name}</p>
                              <p className="text-slate-500 font-semibold">{data.coeName}</p>
                              <div className="border-t border-slate-100 my-1 pt-1 space-y-0.5">
                                <p className="text-slate-600 font-medium">Skill Readiness: <span className="font-bold text-slate-800">{data.readiness}%</span></p>
                                <p className="text-slate-600 font-medium">Utilization Load: <span className="font-bold text-slate-800">{data.utilization}%</span></p>
                                <p className="text-slate-600 font-medium">Approved Skills: <span className="font-bold text-slate-800">{data.skillsCount}</span></p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine x={70} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: "Skill Target (70%)", fill: "#94a3b8", fontSize: 9, position: "insideBottomRight" }} />
                    <ReferenceLine y={80} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: "Optimal Util (80%)", fill: "#94a3b8", fontSize: 9, position: "insideTopLeft" }} />
                    <Scatter name="Employees" data={scatterData} fill={PRIMARY}>
                      {scatterData.map((entry: any, index: number) => {
                        let fill = "#64748b";
                        if (entry.utilization > 100) fill = "#ef4444"; // Red
                        else if (entry.readiness >= 70 && entry.utilization >= 80) fill = "#3b82f6"; // Blue
                        else if (entry.readiness < 70 && entry.utilization < 50) fill = SECONDARY; // Pink
                        else if (entry.readiness >= 70 && entry.utilization < 50) fill = "#10b981"; // Emerald
                        return <Cell key={`cell-${index}`} fill={fill} />;
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Quadrant Legend Guide */}
              <div className="border-t border-slate-100 pt-6">
                <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-3">Matrix Quadrant Guide</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex gap-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-[11px] text-slate-600">
                    <span className="h-3 w-3 rounded-full bg-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">Top-Left: Overloaded Bottleneck</p>
                      <p className="text-slate-400 mt-0.5">High utilization but lower readiness; critical training or offloading needed.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-[11px] text-slate-600">
                    <span className="h-3 w-3 rounded-full bg-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">Top-Right: Stars / Key Performers</p>
                      <p className="text-slate-400 mt-0.5">High skills and high utilization; key contributors driving active projects.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-[11px] text-slate-600">
                    <span className="h-3 w-3 rounded-full bg-pink-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">Bottom-Left: Bench / Skill Deficit</p>
                      <p className="text-slate-400 mt-0.5">Benched or low utilization, and low skill compliance; candidate for upskilling.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-[11px] text-slate-600">
                    <span className="h-3 w-3 rounded-full bg-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">Bottom-Right: Bench / High Potential</p>
                      <p className="text-slate-400 mt-0.5">Fully certified and highly ready but under-allocated; direct allocation candidates.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Row 1: Capacity Burndown & Work Life Balance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Resource Roll-off Timeline (Capacity Burndown) */}
            <SectionCard
              title="Resource Capacity Burndown (FTE Timeline)"
              description="Projected active allocations (FTEs) rolling off over the next 6 months"
              className="md:col-span-2"
            >
              <div className="h-[280px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={burndownData} margin={{ top: 8, right: 16, left: -20, bottom: 4 }}>
                    <defs>
                      <linearGradient id="colorFte" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={PRIMARY} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="period" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "10px",
                        border: "none",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        fontSize: "12px",
                      }}
                    />
                    <Area type="monotone" dataKey="committedFTEs" stroke={PRIMARY} fillOpacity={1} fill="url(#colorFte)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            {/* Work Life Balance & Burnout Risk Monitor */}
            <SectionCard
              title="Work-Life Balance & Burnout Risk"
              description="Resources with >100% project allocation load"
            >
              <div className="overflow-y-auto max-h-[280px] pt-2 space-y-3">
                {burnoutRiskList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                    <p className="text-xs font-semibold text-slate-700">Healthy Workload</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">No resources are currently overallocated.</p>
                  </div>
                ) : (
                  burnoutRiskList.map((emp, i) => (
                    <div key={i} className="flex justify-between items-center p-2.5 rounded-lg border border-rose-100 bg-rose-50/30 text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{emp.name}</p>
                        <p className="text-[10px] text-slate-400">{emp.coeName} · {emp.projectCount} projects</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-rose-600 block">{emp.utilization}%</span>
                        <span className="text-[9px] text-rose-400 font-semibold uppercase tracking-wider">Overload</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>

          {/* Row 2: Upcoming Roll-offs Directory */}
          <SectionCard
            title="Upcoming Resource Roll-Offs & Releases"
            description="Chronological schedule of allocation end dates over the next 90 days"
            flush
          >
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                    <th className="py-2 px-4">Resource</th>
                    <th className="py-2 px-4">COE</th>
                    <th className="py-2 px-4">Project</th>
                    <th className="py-2 px-4">Capacity Released</th>
                    <th className="py-2 px-4">Roll-off Date</th>
                    <th className="py-2 px-4">Timeline Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {upcomingRollOffs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No upcoming project roll-offs scheduled.
                      </td>
                    </tr>
                  ) : (
                    upcomingRollOffs.map((roll, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-slate-800">{roll.employeeName}</td>
                        <td className="py-2.5 px-4 text-slate-600">{roll.coeName}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-700">{roll.projectName}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-500">{roll.allocation}% FTE</td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {roll.endDate ? roll.endDate.toLocaleDateString(undefined, { dateStyle: "medium" }) : "N/A"}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full font-bold",
                              roll.daysLeft <= 15
                                ? "bg-rose-50 text-rose-700 border border-rose-100"
                                : roll.daysLeft <= 45
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            )}
                          >
                            {roll.daysLeft === 0 ? "Today" : `${roll.daysLeft} days remaining`}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
