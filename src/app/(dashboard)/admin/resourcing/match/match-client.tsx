"use client";

import { useState } from "react";
import { recommendForPipelineRequest } from "@/server/actions/recommendation";
import { DecisionCard } from "@/components/shared/decision-card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineRequest } from "@prisma/client";
import type { MatchResult } from "@/server/services/matching.service";

const SIGNAL_STYLES = {
  REDEPLOY: "bg-green-50 text-green-700 border-green-200",
  PARTIAL_HIRE: "bg-amber-50 text-amber-700 border-amber-200",
  HIRE: "bg-red-50 text-red-700 border-red-200",
};

interface MatchClientProps {
  pipelineRequests: PipelineRequest[];
}

export function MatchClient({ pipelineRequests }: MatchClientProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

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
        <CardContent className="px-5 py-4 flex gap-3">
          <Select onValueChange={(v) => setSelectedId(v ?? "")} value={selectedId}>
            <SelectTrigger className="flex-1 max-w-md">
              <SelectValue placeholder="Choose a pipeline request…" />
            </SelectTrigger>
            <SelectContent>
              {pipelineRequests.map((r) => {
                const label = `${r.sowSigned ? "✓ " : ""}${r.client ?? "Unknown client"} — ${r.requestType ?? "N/A"}${r.cluster ? ` (Cluster ${r.cluster})` : ""}`;
                return (
                  <SelectItem key={r.id} value={r.id}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} disabled={!selectedId || loading}>
            {loading ? "Matching…" : "Find Matches"}
          </Button>
        </CardContent>
      </Card>

      {/* Selected request context */}
      {selected && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{selected.skillset ?? "No skillset defined"}</Badge>
          {selected.sowSigned && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">SOW Signed</Badge>}
          {selected.likelyStart && <Badge variant="outline">Starts {new Date(selected.likelyStart).toLocaleDateString()}</Badge>}
          {selected.numberOfWeeks && <Badge variant="outline">{selected.numberOfWeeks}w duration</Badge>}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      )}

      {/* Results */}
      {!loading && results !== null && results.length === 0 && (
        <EmptyState icon={Users} title="No matches found" description="No employees found with the required skills. Consider hiring." />
      )}

      {!loading && results && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{results.length} candidates ranked by match score</p>
          {results.map((r) => {
            const isExpanded = expanded === r.employeeId;
            const variant = r.signal === "REDEPLOY" ? "YES" : r.signal === "PARTIAL_HIRE" ? "YES_WITH_CONDITIONS" : "NO";

            return (
              <DecisionCard
                key={r.employeeId}
                headline={`${r.name} — Match: ${r.matchScore}/100`}
                decisionVariant={variant}
                action={r.signal === "REDEPLOY" ? `Redeploy ${r.name} (${Math.round(r.availableFTE * 100)}% capacity available)` : `Hire externally — ${r.unmetSkills.slice(0, 2).join(", ")} gap`}
                evidence={[
                  `Skill Score: ${r.skillScore}/100`,
                  `Competency Score: ${r.competencyScore}/100`,
                  `Availability: ${Math.round(r.availableFTE * 100)}%`,
                  ...(r.unmetSkills.length ? [`Unmet skills: ${r.unmetSkills.join(", ")}`] : []),
                ]}
                scoreBars={[
                  { label: "Technical Skill", value: r.skillScore, color: "bg-blue-500" },
                  { label: "Consulting Competency", value: r.competencyScore, color: "bg-violet-500" },
                  { label: "Availability", value: r.availabilityFit, color: "bg-green-500" },
                ]}
              >
                {/* Skill breakdown toggle */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : r.employeeId)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  {isExpanded ? "Hide skill breakdown" : "Show skill breakdown"}
                </button>
                {isExpanded && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
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
                        {r.skillBreakdown.map((sb) => (
                          <tr key={sb.skillName} className="border-b last:border-0">
                            <td className="px-3 py-1.5 font-medium">{sb.skillName}</td>
                            <td className="px-3 py-1.5">{sb.required}</td>
                            <td className="px-3 py-1.5">{sb.current}</td>
                            <td className="px-3 py-1.5">
                              <Badge variant="outline" className={cn("text-[10px]", sb.met ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
                                {sb.met ? "✓" : "✗"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DecisionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
