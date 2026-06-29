"use client";

import { useState, useTransition } from "react";
import {
  FileText, Users, Award, CheckCircle2, Clock, TrendingUp,
  AlertTriangle, XCircle, Building2, Briefcase, ChevronDown, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { getTeamMemberDetail, type TeamMemberSummary, type TeamMemberDetail } from "@/server/actions/team-reports";

interface TeamReportsClientProps {
  team: TeamMemberSummary[];
}

function ReadinessBar({ percentage }: { percentage: number }) {
  const color =
    percentage >= 70 ? "bg-emerald-500" : percentage >= 40 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-xs font-bold w-9 text-right">{percentage}%</span>
    </div>
  );
}

function DetailPanel({ detail }: { detail: TeamMemberDetail }) {
  const metCount = detail.gaps.filter((g) => g.status === "met").length;
  const total = detail.gaps.length;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
      {/* Gap breakdown */}
      {detail.gaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Skill Gap - {metCount} of {total} skills met
          </p>
          <div className="space-y-1.5">
            {detail.gaps.map((gap) => (
              <div key={gap.skillName} className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full shrink-0 ${
                  gap.status === "met" ? "bg-emerald-400" : gap.status === "partial" ? "bg-amber-400" : "bg-red-400"
                }`} />
                <span className="flex-1 text-sm text-gray-700 font-medium">{gap.skillName}</span>
                <span className="text-xs text-muted-foreground">
                  {gap.currentLevel} → {gap.targetLevel}
                </span>
                <Badge
                  variant="secondary"
                  className={`border-0 text-[10px] font-semibold rounded-md ${
                    gap.status === "met"
                      ? "bg-emerald-50 text-emerald-700"
                      : gap.status === "partial"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {gap.status === "met" ? "Met" : gap.status === "partial" ? "Partial" : "Missing"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All skills */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          All Skills ({detail.skills.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {detail.skills.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                s.status === "APPROVED"
                  ? "bg-emerald-50 text-emerald-700"
                  : s.status === "PENDING"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              <Award className="h-3 w-3" />
              {s.skillName}
              <span className="font-bold">
                {s.validatedLevel !== null ? s.validatedLevel : s.selfAssessedLevel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TeamReportsClient({ team }: TeamReportsClientProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, TeamMemberDetail>>({});
  const [isPending, startTransition] = useTransition();

  function toggleExpand(memberId: string) {
    if (expandedId === memberId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(memberId);
    if (details[memberId]) return;
    startTransition(async () => {
      const detail = await getTeamMemberDetail(memberId);
      if (detail) {
        setDetails((prev) => ({ ...prev, [memberId]: detail }));
      }
    });
  }

  if (team.length === 0) {
    return (
      <div>
        <PageHeader title="Team Reports" description="Skill health overview for your direct reportees" />
        <EmptyState
          icon={FileText}
          title="No direct reportees"
          description="You currently have no employees reporting to you."
        />
      </div>
    );
  }

  const avgReadiness = Math.round(team.reduce((sum, m) => sum + m.readinessScore, 0) / team.length);
  const onTrack = team.filter((m) => m.readinessScore >= 70).length;

  return (
    <div>
      <PageHeader
        title="Team Reports"
        description="Skill health overview for your direct reportees"
      />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8 stagger-children">
        {[
          { label: "Team Size", value: team.length, gradient: "from-indigo-500 to-violet-500", icon: Users },
          { label: "Avg Readiness", value: `${avgReadiness}%`, gradient: "from-emerald-500 to-teal-500", icon: TrendingUp },
          { label: "On Track (≥70%)", value: onTrack, gradient: "from-amber-500 to-orange-500", icon: CheckCircle2 },
        ].map((stat) => (
          <div key={stat.label} className="stat-card hover-lift">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-3xl font-extrabold mt-1 text-gray-900">{stat.value}</p>
              </div>
              <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-sm`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Team cards */}
      <div className="space-y-3 stagger-children">
        {team.map((member) => {
          const isExpanded = expandedId === member.id;
          const detail = details[member.id];

          return (
            <Card key={member.id} className="border-0 shadow-card rounded-2xl overflow-hidden transition-all">
              <CardContent className="p-5">
                {/* Header row */}
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl gradient-brand flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-extrabold">
                      {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{member.name}</p>
                      <span className="font-mono text-xs text-muted-foreground">{member.employeeCode}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {member.coeName && (
                        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-0 text-[10px] rounded-md font-semibold">
                          <Building2 className="h-3 w-3 mr-0.5" />{member.coeName}
                        </Badge>
                      )}
                      {member.designationName && (
                        <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-0 text-[10px] rounded-md font-semibold">
                          <Briefcase className="h-3 w-3 mr-0.5" />{member.designationName}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Skill counts */}
                  <div className="hidden md:flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground font-medium">Approved</p>
                      <div className="flex items-center gap-1 justify-center mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-sm font-bold text-gray-900">{member.approvedCount}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground font-medium">Pending</p>
                      <div className="flex items-center gap-1 justify-center mt-0.5">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-sm font-bold text-gray-900">{member.pendingCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Readiness */}
                  <div className="hidden lg:block w-40 shrink-0">
                    <p className="text-xs text-muted-foreground font-medium mb-1">
                      Readiness · {member.skillsMet}/{member.totalTargetSkills}
                    </p>
                    <ReadinessBar percentage={member.readinessScore} />
                  </div>

                  {/* Expand button */}
                  <button
                    onClick={() => toggleExpand(member.id)}
                    className="h-8 w-8 rounded-xl flex items-center justify-center bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0 cursor-pointer"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  isPending && !detail ? (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-muted-foreground">
                      <div className="h-4 w-4 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
                      <span className="text-sm">Loading…</span>
                    </div>
                  ) : detail ? (
                    <DetailPanel detail={detail} />
                  ) : null
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
