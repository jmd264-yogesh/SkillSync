"use client";

import { useState, useTransition } from "react";
import {
  Search, Users, Award, Building2, Briefcase, Filter, X,
  TrendingUp, AlertTriangle, CheckCircle2, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Progress } from "@/components/ui/progress";
import { searchTalent } from "@/server/actions/talent-discovery";
import { COMPETENCY_LABEL, type CompetencyLevel } from "@/lib/constants";

function levelLabel(avg: number): string {
  const clamped = Math.min(5, Math.max(1, Math.round(avg))) as CompetencyLevel;
  return COMPETENCY_LABEL[clamped] ?? "-";
}
import type { SkillCategory } from "@prisma/client";

interface FilterOptions {
  skills: { id: string; name: string; category: SkillCategory }[];
  coes: { id: string; name: string }[];
  designations: { id: string; name: string }[];
}

interface DemandProfileEntry {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  projectDemand: number;
  employeeSupply: number;
  avgSupplyLevel: number;
  avgRequiredLevel: number;
  gap: number;
}

interface EmployeeResult {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
  coe: { name: string } | null;
  designation: { name: string } | null;
  manager: { name: string } | null;
  employeeSkills: {
    id: string;
    validatedLevel: number | null;
    skill: { name: string; category: SkillCategory };
  }[];
}

const categoryColors: Record<SkillCategory, string> = {
  SKILL: "bg-blue-500/10 text-blue-700",
  FRAMEWORK: "bg-purple-500/10 text-purple-700",
  CONCEPT: "bg-amber-500/10 text-amber-700",
  TOOL: "bg-emerald-500/10 text-emerald-700",
  CERTIFICATION: "bg-red-500/10 text-red-700",
};

const categoryBg: Record<SkillCategory, string> = {
  SKILL: "bg-blue-50 text-blue-700 border-blue-200",
  FRAMEWORK: "bg-purple-50 text-purple-700 border-purple-200",
  CONCEPT: "bg-amber-50 text-amber-700 border-amber-200",
  TOOL: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CERTIFICATION: "bg-red-50 text-red-700 border-red-200",
};

interface TalentClientProps {
  options: FilterOptions;
  demandProfile: DemandProfileEntry[];
}

export function TalentClient({ options, demandProfile }: TalentClientProps) {
  const [results, setResults] = useState<EmployeeResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState({ skillId: "", minLevel: "", coeId: "", designationId: "" });

  function handleSearch() {
    startTransition(async () => {
      const res = await searchTalent({
        skillId: filters.skillId || undefined,
        minLevel: filters.minLevel ? Number(filters.minLevel) : undefined,
        coeId: filters.coeId || undefined,
        designationId: filters.designationId || undefined,
      });
      setResults(res);
      setHasSearched(true);
    });
  }

  function clearFilters() {
    setFilters({ skillId: "", minLevel: "", coeId: "", designationId: "" });
    setResults([]);
    setHasSearched(false);
  }

  const hasFilters = Object.values(filters).some(Boolean);

  const criticalGaps = demandProfile.filter((s) => s.gap > 0).length;
  const surplusSkills = demandProfile.filter((s) => s.gap < 0).length;
  const maxDemand = Math.max(...demandProfile.map((s) => s.projectDemand), 1);

  return (
    <div>
      <PageHeader title="Talent Discovery" description="Search talent and analyze skill supply vs project demand" />

      <Tabs defaultValue="search" className="space-y-6">
        <TabsList className="bg-white border border-slate-200 shadow-sm p-1 rounded-xl h-auto gap-1">
          <TabsTrigger
            value="search"
            className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-5 py-2 text-sm font-medium transition-all"
          >
            <Search className="h-4 w-4 mr-2" />
            Talent Search
          </TabsTrigger>
          <TabsTrigger
            value="demand"
            className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-5 py-2 text-sm font-medium transition-all"
          >
            <BarChart2 className="h-4 w-4 mr-2" />
            Skill Demand Profiler
          </TabsTrigger>
        </TabsList>

        {/* ── Talent Search tab ── */}
        <TabsContent value="search" className="space-y-6 mt-0">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" /> Search Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Skill</Label>
                  <select value={filters.skillId} onChange={(e) => setFilters({ ...filters, skillId: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Any skill</option>
                    {options.skills.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Minimum Level</Label>
                  <select value={filters.minLevel} onChange={(e) => setFilters({ ...filters, minLevel: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Any level</option>
                    {([1, 2, 3, 4, 5] as const).map((l) => (
                      <option key={l} value={l}>{l} - {COMPETENCY_LABEL[l]}+</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>COE</Label>
                  <select value={filters.coeId} onChange={(e) => setFilters({ ...filters, coeId: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Any COE</option>
                    {options.coes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <select value={filters.designationId} onChange={(e) => setFilters({ ...filters, designationId: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Any designation</option>
                    {options.designations.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button onClick={handleSearch} disabled={isPending}>
                  <Search className="h-4 w-4 mr-2" />
                  {isPending ? "Searching..." : "Search"}
                </Button>
                {hasFilters && (
                  <Button variant="outline" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" /> Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {!hasSearched ? (
            <EmptyState icon={Search} title="Start searching" description="Apply filters above and click Search to discover talent." />
          ) : results.length === 0 ? (
            <EmptyState icon={Users} title="No matches found" description="Try adjusting your filters to broaden the search." />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm text-white px-3 py-1.5">
                  {results.length} employee{results.length !== 1 ? "s" : ""} found
                </Badge>
              </div>
              <div className="grid gap-3">
                {results.map((emp) => (
                  <Card key={emp.id} className="border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                          <span className="text-white font-bold text-lg">
                            {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{emp.name}</h3>
                            <p className="text-sm text-muted-foreground font-mono">{emp.employeeCode}</p>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                            {emp.coe && (
                              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{emp.coe.name}</span>
                            )}
                            {emp.designation && (
                              <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{emp.designation.name}</span>
                            )}
                            {emp.manager && (
                              <span className="flex items-center gap-1"><Users className="h-3 w-3" />Reports to {emp.manager.name}</span>
                            )}
                          </div>

                          {emp.employeeSkills.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {emp.employeeSkills.map((es) => (
                                <div key={es.id} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs">
                                  <Badge variant="outline" className={`${categoryColors[es.skill.category]} text-[10px] px-1 py-0`}>
                                    {es.skill.category.charAt(0)}
                                  </Badge>
                                  <span className="font-medium">{es.skill.name}</span>
                                  <div className="flex items-center gap-1 ml-1">
                                    <Progress value={((es.validatedLevel ?? 0) / 5) * 100} className="w-10 h-1.5" />
                                    <span className="font-mono text-[10px]">{es.validatedLevel}/5</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <Badge variant="secondary" className="shrink-0 text-white">
                          <Award className="h-3 w-3 mr-1" />
                          {emp.employeeSkills.length} skills
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Skill Demand Profiler tab ── */}
        <TabsContent value="demand" className="space-y-6 mt-0">
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{demandProfile.length}</p>
                  <p className="text-xs text-muted-foreground">Skills in demand</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-red-200 shadow-sm bg-red-50/40">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-700">{criticalGaps}</p>
                  <p className="text-xs text-red-600/80">Skills with supply gap</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-emerald-200 shadow-sm bg-emerald-50/40">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{surplusSkills}</p>
                  <p className="text-xs text-emerald-600/80">Skills with surplus supply</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {demandProfile.length === 0 ? (
            <EmptyState icon={BarChart2} title="No demand data" description="Add active or planning projects with skill requirements to see the demand profile." />
          ) : (
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" />
                  Skill Supply vs Demand
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    - ranked by project headcount demand (active + planning projects)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {/* Header row */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-4 px-5 py-3 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <span>Skill</span>
                    <span className="text-center">Demand</span>
                    <span className="text-center">Supply</span>
                    <span className="text-center">Req. Level</span>
                    <span className="text-center">Avg Level</span>
                    <span className="text-center">Status</span>
                  </div>

                  {demandProfile.map((entry) => {
                    const isGap = entry.gap > 0;
                    const isSurplus = entry.gap < 0;
                    const supplyPct = entry.projectDemand > 0
                      ? Math.min(100, Math.round((entry.employeeSupply / entry.projectDemand) * 100))
                      : 100;

                    return (
                      <div
                        key={entry.skillId}
                        className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-4 px-5 py-4 items-center hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Skill name + category */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-slate-800 truncate">{entry.skillName}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${categoryBg[entry.category]}`}>
                              {entry.category}
                            </Badge>
                          </div>
                          {/* Mini bar */}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isGap ? "bg-red-400" : "bg-emerald-400"}`}
                                style={{ width: `${(entry.projectDemand / maxDemand) * 100}%` }}
                              />
                            </div>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-400 transition-all"
                                style={{ width: `${(entry.employeeSupply / maxDemand) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" /> Demand
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" /> Supply
                            </span>
                          </div>
                        </div>

                        {/* Demand count */}
                        <div className="text-center">
                          <span className="text-base font-bold text-slate-800">{entry.projectDemand}</span>
                          <p className="text-[10px] text-muted-foreground">headcount</p>
                        </div>

                        {/* Supply count */}
                        <div className="text-center">
                          <span className="text-base font-bold text-slate-800">{entry.employeeSupply}</span>
                          <p className="text-[10px] text-muted-foreground">employees</p>
                          {entry.projectDemand > 0 && (
                            <p className="text-[10px] font-medium mt-0.5" style={{ color: isGap ? "#ef4444" : "#10b981" }}>
                              {supplyPct}% filled
                            </p>
                          )}
                        </div>

                        {/* Required level */}
                        <div className="text-center">
                          {entry.avgRequiredLevel > 0 ? (
                            <>
                              <span className="text-base font-bold text-slate-800">{entry.avgRequiredLevel}</span>
                              <p className="text-[10px] text-muted-foreground">
                                {levelLabel(entry.avgRequiredLevel)}
                              </p>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>

                        {/* Avg supply level */}
                        <div className="text-center">
                          {entry.avgSupplyLevel > 0 ? (
                            <>
                              <span className="text-base font-bold text-slate-800">{entry.avgSupplyLevel}</span>
                              <p className="text-[10px] text-muted-foreground">
                                {levelLabel(entry.avgSupplyLevel)}
                              </p>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>

                        {/* Status badge */}
                        <div className="flex justify-center">
                          {isGap ? (
                            <Badge className="bg-red-50 text-red-700 border-red-200 border text-[11px] font-semibold px-2.5">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Gap {entry.gap > 0 ? `+${entry.gap}` : entry.gap}
                            </Badge>
                          ) : isSurplus ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border text-[11px] font-semibold px-2.5">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Surplus
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 border text-[11px] font-semibold px-2.5">
                              Balanced
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
