"use client";

import { useState } from "react";
import { recommendForPipelineRequest } from "@/server/actions/recommendation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import {
  Users, CheckCircle2, AlertTriangle, XCircle,
  Briefcase, MapPin, Shield, Star, Clock, Calendar, ChevronDown, ChevronUp, User,
} from "lucide-react";
import type { PipelineRequest } from "@prisma/client";
import type { MatchResult, RiskFlag } from "@/server/services/matching.service";

const RISK_CONFIG: Record<RiskFlag, { label: string; color: string }> = {
  LEAVER:             { label: "On Notice",        color: "bg-red-50 text-red-700 border-red-200" },
  OVER_ALLOCATED:     { label: "Over-Allocated",    color: "bg-orange-50 text-orange-700 border-orange-200" },
  GHOST:              { label: "Ghost Resource",    color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  SKILL_GAP_FOR_ROLE: { label: "Skill Gap",         color: "bg-pink-50 text-pink-700 border-pink-200" },
  ON_LEAVE:           { label: "Planned Leave",     color: "bg-blue-50 text-blue-700 border-blue-200" },
  UNDER_LEVELLED:     { label: "Under-Levelled",    color: "bg-purple-50 text-purple-700 border-purple-200" },
  LOW_EXPERIENCE:     { label: "Low Experience",    color: "bg-slate-50 text-slate-700 border-slate-200" },
};

const SIGNAL_CONFIG = {
  REDEPLOY:     { label: "Ready to Deploy", icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-50 border-green-200" },
  PARTIAL_HIRE: { label: "Partial Match",   icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  HIRE:         { label: "Hire Required",   icon: XCircle,       color: "text-red-600",   bg: "bg-red-50 border-red-200" },
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
        {/* Header */}
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
            <span className="text-lg font-bold text-slate-800">
              {result.matchScore}<span className="text-xs font-normal text-slate-400">/100</span>
            </span>
          </div>
        </div>

        {/* Availability + Leave + Notice + Projects */}
        <div className="flex flex-wrap gap-2 text-xs">
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
              <span className="font-semibold text-slate-800">{result.noticeDaysRemaining}d</span>
            </div>
          )}
          {result.plannedLeaveDays > 0 && (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-md px-2 py-1">
              <Calendar className="h-3 w-3 text-blue-600" />
              <span className="text-slate-600">Leave:</span>
              <span className="font-semibold text-slate-800">{result.plannedLeaveDays}d in window</span>
            </div>
          )}
          {result.totalProjects > 0 && (
            <div className="flex items-center gap-1.5 bg-white border rounded-md px-2 py-1">
              <Briefcase className="h-3 w-3 text-violet-600" />
              <span className="text-slate-600">{result.totalProjects} projects</span>
            </div>
          )}
        </div>

        {/* Score bars */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <ScoreBar label="Technical Skill"   value={result.skillScore}       color="bg-blue-500" />
          <ScoreBar label="Competency"        value={result.competencyScore}  color="bg-violet-500" />
          <ScoreBar label="Availability"      value={result.availabilityFit}  color="bg-green-500" />
          <ScoreBar label="Evidence / Track"  value={result.evidenceStrength} color="bg-amber-500" />
        </div>

        {/* Previous clients */}
        {result.previousClients.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-slate-600">Previous clients: </span>
            {result.previousClients.join(" · ")}
          </p>
        )}

        {/* Unmet skills */}
        {result.unmetSkills.length > 0 && (
          <p className="text-xs text-red-600">
            <span className="font-medium">Skill gaps: </span>
            {result.unmetSkills.join(", ")}
          </p>
        )}

        {/* Skill breakdown toggle */}
        {result.skillBreakdown.length > 0 && (
          <>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide" : "Show"} skill breakdown
            </button>
            {expanded && (
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
                            sb.met ? "bg-green-50 text-green-700 border-green-200"
                                   : "bg-red-50 text-red-700 border-red-200")}>
                            {sb.met ? "✓" : "✗"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface MatchClientProps {
  pipelineRequests: PipelineRequest[];
}

export function MatchClient({ pipelineRequests }: MatchClientProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sowFilter, setSowFilter] = useState<"ALL" | "CONFIRMED" | "PROBABLE">("ALL");
  const [signalFilter, setSignalFilter] = useState<"ALL" | "REDEPLOY" | "PARTIAL_HIRE" | "HIRE">("ALL");

  const filteredRequests = pipelineRequests.filter((r) => {
    if (sowFilter === "CONFIRMED") return r.sowSigned;
    if (sowFilter === "PROBABLE") return !r.sowSigned;
    return true;
  });

  const filteredResults = results
    ? results.filter((r) => signalFilter === "ALL" || r.signal === signalFilter)
    : null;

  async function handleSearch() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const data = await recommendForPipelineRequest(selectedId);
      setResults(data);
    } finally {
      setLoading(false);
    }
  }

  const selected = pipelineRequests.find((r) => r.id === selectedId);

  return (
    <div className="space-y-5">
      {/* Pipeline request selector */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-5 py-3 pb-0">
          <CardTitle className="text-sm font-semibold text-slate-700">Select Pipeline Request</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Select
              value={sowFilter}
              onValueChange={(v) => { setSowFilter((v as typeof sowFilter) ?? "ALL"); setSelectedId(""); }}
            >
              <SelectTrigger className="h-8 text-sm w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All requests ({pipelineRequests.length})</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed SOW ✓ ({pipelineRequests.filter(r => r.sowSigned).length})</SelectItem>
                <SelectItem value="PROBABLE">Probable ({pipelineRequests.filter(r => !r.sowSigned).length})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Select onValueChange={(v) => setSelectedId(v ?? "")} value={selectedId}>
              <SelectTrigger className="flex-1 max-w-xl">
                <SelectValue placeholder="Choose a pipeline request…" />
              </SelectTrigger>
              <SelectContent>
                {filteredRequests.map((r) => {
                  const label = `${r.sowSigned ? "✓ " : ""}${r.client ?? "Unknown client"} - ${r.requestType ?? "N/A"}${r.cluster ? ` (Cluster ${r.cluster})` : ""}`;
                  return (
                    <SelectItem key={r.id} value={r.id}>{label}</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={!selectedId || loading}>
              {loading ? "Matching…" : "Find Matches"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Selected request context - project type + start date + cluster */}
      {selected && (
        <Card className="border-0 shadow-sm bg-slate-50">
          <CardContent className="px-4 py-3">
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <span className="font-semibold text-slate-800">
                {selected.client ?? "Unknown client"}
              </span>
              {selected.requestType && (
                <Badge variant="outline" className="text-[11px]">
                  Type: {selected.requestType}
                </Badge>
              )}
              {selected.likelyStart && (
                <Badge variant="outline" className="text-[11px]">
                  Start: {new Date(selected.likelyStart).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </Badge>
              )}
              {selected.numberOfWeeks && (
                <Badge variant="outline" className="text-[11px]">
                  {selected.numberOfWeeks}w duration
                </Badge>
              )}
              {selected.cluster && (
                <Badge variant="outline" className="text-[11px]">
                  Cluster {selected.cluster}
                </Badge>
              )}
              {selected.sowSigned && (
                <Badge variant="outline" className="text-[11px] bg-green-50 text-green-700 border-green-200">
                  SOW Signed ✓
                </Badge>
              )}
              {selected.skillset && (
                <span className="text-muted-foreground truncate max-w-xs" title={selected.skillset}>
                  Skills: {selected.skillset}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      )}

      {/* Results */}
      {!loading && results !== null && results.length === 0 && (
        <EmptyState icon={Users} title="No matches found" description="No employees found. Consider hiring externally." />
      )}

      {!loading && results && results.length > 0 && (
        <div className="space-y-3">
          {/* Controls + risk summary */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                {filteredResults?.length ?? 0} of {results.length} candidates
              </p>
              <Select
                value={signalFilter}
                onValueChange={(v) => setSignalFilter((v as typeof signalFilter) ?? "ALL")}
              >
                <SelectTrigger className="h-7 text-xs w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All signals</SelectItem>
                  <SelectItem value="REDEPLOY">Ready to deploy ✓</SelectItem>
                  <SelectItem value="PARTIAL_HIRE">Partial match ~</SelectItem>
                  <SelectItem value="HIRE">Hire required ✗</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Risk summary pills */}
            {results.some((r) => r.riskFlags.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {(["LEAVER","OVER_ALLOCATED","GHOST","ON_LEAVE","SKILL_GAP_FOR_ROLE","UNDER_LEVELLED","LOW_EXPERIENCE"] as RiskFlag[]).map((flag) => {
                  const count = results.filter((r) => r.riskFlags.includes(flag)).length;
                  if (count === 0) return null;
                  return (
                    <Badge key={flag} variant="outline" className={cn("text-[10px]", RISK_CONFIG[flag].color)}>
                      {count}× {RISK_CONFIG[flag].label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {(filteredResults ?? []).map((r, i) => (
            <CandidateCard key={r.employeeId} result={r} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
