"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { recommendAdHoc } from "@/server/actions/recommendation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PROJECT_CATEGORY_LABELS } from "@/lib/constants";
import type { MatchResult, RiskFlag } from "@/server/services/matching.service";
import {
  AlertTriangle, CheckCircle2, XCircle, User, Briefcase, MapPin,
  Clock, Calendar, Shield, Star, ChevronDown, ChevronUp,
} from "lucide-react";

interface Props {
  skills: { id: string; name: string; category: string }[];
  designations: { id: string; name: string; level: number }[];
  coes: { id: string; name: string }[];
}

interface FormValues {
  projectName: string;
  projectType: string;
  startDate: string;
  endDate: string;
  role: string;
  requiredSkillIds: string[];
  competencyLevel: string;
  headcount: string;
}

const RISK_CONFIG: Record<RiskFlag, { label: string; color: string }> = {
  LEAVER:            { label: "On Notice",       color: "bg-red-50 text-red-700 border-red-200" },
  OVER_ALLOCATED:    { label: "Over-Allocated",   color: "bg-orange-50 text-orange-700 border-orange-200" },
  GHOST:             { label: "Ghost Resource",   color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  SKILL_GAP_FOR_ROLE:{ label: "Skill Gap",        color: "bg-pink-50 text-pink-700 border-pink-200" },
  ON_LEAVE:          { label: "Planned Leave",    color: "bg-blue-50 text-blue-700 border-blue-200" },
  UNDER_LEVELLED:    { label: "Under-Levelled",   color: "bg-purple-50 text-purple-700 border-purple-200" },
  LOW_EXPERIENCE:    { label: "Low Experience",   color: "bg-slate-50 text-slate-700 border-slate-200" },
};

const SIGNAL_CONFIG = {
  REDEPLOY:     { label: "Ready to Deploy",   icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-50 border-green-200" },
  PARTIAL_HIRE: { label: "Partial Match",     icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  HIRE:         { label: "Hire Required",     icon: XCircle,       color: "text-red-600",   bg: "bg-red-50 border-red-200" },
};

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-medium text-slate-700">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function CandidateCard({ result, rank }: { result: MatchResult; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const sig = SIGNAL_CONFIG[result.signal];
  const SigIcon = sig.icon;

  return (
    <Card className={cn("border shadow-sm", sig.bg)}>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-400 shrink-0">#{rank}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-slate-900">
                  [{result.employeeCode}] {result.name}
                </span>
                {result.riskFlags.map((f) => (
                  <Badge key={f} variant="outline" className={cn("text-[10px] px-1.5 py-0", RISK_CONFIG[f].color)}>
                    {RISK_CONFIG[f].label}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                {result.jobName && (
                  <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{result.jobName}</span>
                )}
                {result.designationName && (
                  <span className="flex items-center gap-1"><Star className="h-3 w-3" />{result.designationName}</span>
                )}
                {result.coeName && (
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{result.coeName}</span>
                )}
                {result.location && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{result.location}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0 gap-1">
            <div className="flex items-center gap-1.5">
              <SigIcon className={cn("h-4 w-4", sig.color)} />
              <span className={cn("text-xs font-semibold", sig.color)}>{sig.label}</span>
            </div>
            <span className="text-lg font-bold text-slate-800">{result.matchScore}<span className="text-xs font-normal text-slate-400">/100</span></span>
          </div>
        </div>

        {/* Availability + Leave + Notice */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-white border rounded-md px-2 py-1">
            <User className="h-3 w-3 text-green-600" />
            <span className="text-slate-600">Availability:</span>
            <span className="font-semibold text-slate-800">{Math.round(result.availableFTE * 100)}%</span>
          </div>
          {result.noticeDaysRemaining !== null && (
            <div className={cn("flex items-center gap-1.5 border rounded-md px-2 py-1",
              result.noticeDaysRemaining <= 30 ? "bg-red-50 border-red-200" : "bg-white")}>
              <Clock className="h-3 w-3 text-red-500" />
              <span className="text-slate-600">Notice:</span>
              <span className="font-semibold text-slate-800">{result.noticeDaysRemaining}d remaining</span>
            </div>
          )}
          {result.plannedLeaveDays > 0 && (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-md px-2 py-1">
              <Calendar className="h-3 w-3 text-blue-600" />
              <span className="text-slate-600">Planned leave:</span>
              <span className="font-semibold text-slate-800">{result.plannedLeaveDays}d in window</span>
            </div>
          )}
          {result.totalProjects > 0 && (
            <div className="flex items-center gap-1.5 bg-white border rounded-md px-2 py-1">
              <Briefcase className="h-3 w-3 text-violet-600" />
              <span className="text-slate-600">Projects:</span>
              <span className="font-semibold text-slate-800">{result.totalProjects}</span>
            </div>
          )}
        </div>

        {/* Score bars */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <ScoreBar label="Technical Skill"       value={result.skillScore}      color="bg-blue-500" />
          <ScoreBar label="Competency"            value={result.competencyScore} color="bg-violet-500" />
          <ScoreBar label="Availability"          value={result.availabilityFit} color="bg-green-500" />
          <ScoreBar label="Evidence Strength"     value={result.evidenceStrength}color="bg-amber-500" />
        </div>

        {/* Previous clients */}
        {result.previousClients.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-slate-600">Previous clients: </span>
            {result.previousClients.join(" · ")}
          </div>
        )}

        {/* Unmet skills */}
        {result.unmetSkills.length > 0 && (
          <div className="text-xs text-red-600">
            <span className="font-medium">Skill gaps: </span>
            {result.unmetSkills.join(", ")}
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Hide" : "Show"} skill breakdown
        </button>

        {expanded && result.skillBreakdown.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-3 py-1.5 text-left text-slate-500">Skill</th>
                  <th className="px-3 py-1.5 text-left text-slate-500">Required</th>
                  <th className="px-3 py-1.5 text-left text-slate-500">Current</th>
                  <th className="px-3 py-1.5 text-left text-slate-500">Met</th>
                </tr>
              </thead>
              <tbody>
                {result.skillBreakdown.map((sb) => (
                  <tr key={sb.skillName} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-medium">{sb.skillName}</td>
                    <td className="px-3 py-1.5">{sb.required}</td>
                    <td className="px-3 py-1.5">{sb.current}</td>
                    <td className="px-3 py-1.5">
                      <Badge variant="outline" className={cn("text-[10px]",
                        sb.met ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
                        {sb.met ? "✓" : "✗"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function QuestionnaireClient({ skills, designations, coes }: Props) {
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedForm, setSubmittedForm] = useState<FormValues | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      projectName: "",
      projectType: "",
      startDate: "",
      endDate: "",
      role: "",
      requiredSkillIds: [],
      competencyLevel: "3",
      headcount: "1",
    },
  });

  function toggleSkill(id: string) {
    setSelectedSkillIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  async function onSubmit(data: FormValues) {
    if (selectedSkillIds.length === 0) return;
    setLoading(true);
    try {
      const level = parseInt(data.competencyLevel);
      const requiredSkills = selectedSkillIds.map((id) => {
        const skill = skills.find((s) => s.id === id);
        return { skillId: id, skillName: skill?.name ?? id, requiredLevel: level };
      });
      const canonical = data.role.trim() ? [data.role.trim()] : undefined;
      const res = await recommendAdHoc({
        requiredSkills,
        canonicalRoles: canonical,
        windowStart: data.startDate ? new Date(data.startDate).toISOString() : undefined,
        windowEnd: data.endDate ? new Date(data.endDate).toISOString() : undefined,
        topN: 15,
      });
      setResults(res);
      setSubmittedForm(data);
    } finally {
      setLoading(false);
    }
  }

  const groupedSkills = skills.reduce<Record<string, typeof skills>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category]!.push(s);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
      {/* ── Questionnaire form ── */}
      <Card className="border-0 shadow-sm sticky top-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Project Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="projectName">Project Name</Label>
              <Input id="projectName" placeholder="e.g. Vodafone Data Platform" {...register("projectName")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Project Type</Label>
                <Controller
                  name="projectType"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select type…" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROJECT_CATEGORY_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Headcount Needed</Label>
                <Input type="number" min={1} max={20} {...register("headcount")} className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date</Label>
                <Input type="date" id="startDate" {...register("startDate")} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date</Label>
                <Input type="date" id="endDate" {...register("endDate")} className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role">Required Role / Job Title</Label>
              <Input id="role" placeholder="e.g. Data Engineer" {...register("role")} />
            </div>

            <div className="space-y-1.5">
              <Label>Minimum Competency Level (1–5)</Label>
              <Controller
                name="competencyLevel"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Beginner</SelectItem>
                      <SelectItem value="2">2 - Basic</SelectItem>
                      <SelectItem value="3">3 - Intermediate</SelectItem>
                      <SelectItem value="4">4 - Advanced</SelectItem>
                      <SelectItem value="5">5 - Expert</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>
                Required Skills
                {selectedSkillIds.length > 0 && (
                  <span className="ml-2 text-xs text-primary font-normal">({selectedSkillIds.length} selected)</span>
                )}
              </Label>
              <div className="border rounded-lg max-h-52 overflow-y-auto p-2 space-y-3">
                {Object.entries(groupedSkills).map(([cat, catSkills]) => (
                  <div key={cat}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-1">{cat}</p>
                    <div className="flex flex-wrap gap-1">
                      {catSkills.map((s) => {
                        const selected = selectedSkillIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSkill(s.id)}
                            className={cn(
                              "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                              selected
                                ? "bg-primary text-white border-primary"
                                : "bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary",
                            )}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {selectedSkillIds.length === 0 && (
                <p className="text-xs text-red-500">Select at least one skill</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || selectedSkillIds.length === 0}>
              {loading ? "Finding best matches…" : "Find Resources"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Results panel ── */}
      <div className="space-y-4">
        {/* Project context banner */}
        {submittedForm && results !== null && (
          <Card className="border-0 shadow-sm bg-slate-50">
            <CardContent className="px-4 py-3">
              <div className="flex flex-wrap gap-2 items-center text-xs">
                <span className="font-semibold text-slate-800 text-sm">
                  {submittedForm.projectName || "Untitled Project"}
                </span>
                {submittedForm.projectType && (
                  <Badge variant="outline" className="text-[11px]">
                    {PROJECT_CATEGORY_LABELS[submittedForm.projectType] ?? submittedForm.projectType}
                  </Badge>
                )}
                {submittedForm.startDate && (
                  <Badge variant="outline" className="text-[11px]">
                    Starts {new Date(submittedForm.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </Badge>
                )}
                {submittedForm.endDate && (
                  <Badge variant="outline" className="text-[11px]">
                    Ends {new Date(submittedForm.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </Badge>
                )}
                {submittedForm.role && (
                  <Badge variant="outline" className="text-[11px]">Role: {submittedForm.role}</Badge>
                )}
                <Badge variant="outline" className="text-[11px]">
                  {results.length} candidate{results.length !== 1 ? "s" : ""} ranked
                </Badge>
              </div>

              {/* Risk summary */}
              {results.some((r) => r.riskFlags.length > 0) && (
                <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-muted-foreground font-medium">Risk summary:</span>
                  {(["LEAVER","OVER_ALLOCATED","GHOST","ON_LEAVE","SKILL_GAP_FOR_ROLE","UNDER_LEVELLED","LOW_EXPERIENCE"] as RiskFlag[]).map((flag) => {
                    const count = results.filter((r) => r.riskFlags.includes(flag)).length;
                    if (count === 0) return null;
                    return (
                      <Badge key={flag} variant="outline" className={cn("text-[10px]", RISK_CONFIG[flag].color)}>
                        {count} {RISK_CONFIG[flag].label}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        )}

        {!loading && results !== null && results.length === 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No candidates found. Try relaxing the skill requirements or role filter.
            </CardContent>
          </Card>
        )}

        {!loading && results && results.length > 0 && (
          <div className="space-y-3">
            {results.map((r, i) => (
              <CandidateCard key={r.employeeId} result={r} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
