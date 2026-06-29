import {
  FileBarChart, User, Building2, Briefcase, Users, Award,
  CheckCircle2, TrendingUp, XCircle, AlertTriangle, FileCheck,
  Star, Target, BarChart3, Clock, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const LEVEL_NAMES: Record<number, string> = {
  0: "Unrated", 1: "Beginner", 2: "Basic", 3: "Intermediate", 4: "Advanced", 5: "Expert",
};

const STATUS_STYLE = {
  APPROVED: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Approved" },
  PENDING: { bg: "bg-amber-50", text: "text-amber-700", label: "Pending" },
  REJECTED: { bg: "bg-red-50", text: "text-red-700", label: "Rejected" },
} as const;

function ReadinessRing({ percentage }: { percentage: number }) {
  const r = 62;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 70 ? "#10b981" : percentage >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-44 h-44 -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-extrabold text-gray-900">{percentage}%</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Readiness</span>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className = "" }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden ${className}`}>
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h2 className="font-bold text-gray-900 text-base">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

export default async function MyReportPage() {
  const session = await auth();
  if (!session?.user?.employeeId) {
    return (
      <EmptyState icon={FileBarChart} title="Not available" description="Your account is not linked to an employee profile." />
    );
  }

  const employee = await db.employee.findUnique({
    where: { id: session.user.employeeId },
    include: {
      coe: { include: { coeSkills: { include: { skill: true } } } },
      designation: { include: { designationSkills: { include: { skill: true } } } },
      manager: true,
      employeeSkills: {
        include: { skill: true, evidences: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!employee) {
    return (
      <EmptyState icon={FileBarChart} title="Profile not found" description="Employee profile could not be loaded." />
    );
  }

  // Build gap analysis
  const targetMap = new Map<string, { targetLevel: number; skillName: string; source: string }>();
  for (const cs of employee.coe?.coeSkills ?? []) {
    targetMap.set(cs.skillId, { targetLevel: cs.targetCompetency, skillName: cs.skill.name, source: "COE" });
  }
  for (const ds of employee.designation?.designationSkills ?? []) {
    const existing = targetMap.get(ds.skillId);
    if (existing) {
      targetMap.set(ds.skillId, {
        ...existing,
        targetLevel: Math.max(existing.targetLevel, ds.targetCompetency),
        source: "Both",
      });
    } else {
      targetMap.set(ds.skillId, { targetLevel: ds.targetCompetency, skillName: ds.skill.name, source: "Designation" });
    }
  }

  const approved = employee.employeeSkills.filter((s) => s.status === "APPROVED");
  const pending = employee.employeeSkills.filter((s) => s.status === "PENDING");
  const currentLevels = new Map<string, number>();
  for (const es of approved) {
    currentLevels.set(es.skillId, es.validatedLevel ?? 0);
  }

  const gaps = Array.from(targetMap.entries()).map(([skillId, target]) => {
    const current = currentLevels.get(skillId) ?? 0;
    const gap = Math.max(0, target.targetLevel - current);
    return {
      skillId,
      skillName: target.skillName,
      targetLevel: target.targetLevel,
      currentLevel: current,
      gap,
      source: target.source,
      status: gap === 0 ? "met" : current > 0 ? "partial" : "missing",
    } as const;
  });
  gaps.sort((a, b) => b.gap - a.gap);

  const met = gaps.filter((g) => g.status === "met").length;
  const partial = gaps.filter((g) => g.status === "partial").length;
  const missing = gaps.filter((g) => g.status === "missing").length;
  const total = gaps.length;
  const readinessPercentage = total > 0 ? Math.round((met / total) * 100) : 0;

  const certifications = employee.employeeSkills.flatMap((es) =>
    es.evidences
      .filter((e) => e.type === "CERTIFICATION" || e.type === "ASSESSMENT_SCORE")
      .map((e) => ({ ...e, skillName: es.skill.name, skillStatus: es.status }))
  );

  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const avgValidatedLevel = approved.length > 0
    ? (approved.reduce((sum, es) => sum + (es.validatedLevel ?? es.selfAssessedLevel), 0) / approved.length).toFixed(1)
    : "0";
  const topGaps = gaps.filter((g) => g.status !== "met").slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader title="My Skill Report" description={`Generated on ${today}`} />

      {/* 1. Employee Identity Card */}
      <SectionCard title="Employee Profile" icon={User}>
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shrink-0">
            <span className="text-white text-2xl font-extrabold">
              {employee.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-extrabold text-gray-900">{employee.name}</h2>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">{employee.employeeCode} · {employee.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 mt-5 pt-5 border-t border-slate-100">
          {[
            { icon: Building2, label: "COE", value: employee.coe?.name ?? "-" },
            { icon: Briefcase, label: "Designation", value: employee.designation?.name ?? "-" },
            { icon: Users, label: "Manager", value: employee.manager?.name ?? "-" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <item.icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-semibold text-muted-foreground">{item.label}:</span>
              <span className="text-sm font-bold text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 2. KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Approved Skills", value: approved.length, icon: CheckCircle2, bg: "bg-indigo-50", text: "text-primary" },
          { label: "Avg Skill Level", value: avgValidatedLevel, icon: Star, bg: "bg-indigo-50", text: "text-primary" },
          { label: "Pending Review", value: pending.length, icon: Clock, bg: "bg-indigo-50", text: "text-primary" },
          { label: "Certifications", value: certifications.length, icon: Award, bg: "bg-indigo-50", text: "text-primary" },
        ].map((kpi) => (
          <div key={kpi.label} className="stat-card flex items-center gap-3.5">
            <div className={`h-10 w-10 rounded-xl ${kpi.bg} flex items-center justify-center shrink-0`}>
              <kpi.icon className={`h-5 w-5 ${kpi.text}`} />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{kpi.value}</p>
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Skill Readiness */}
      {gaps.length > 0 && (
        <SectionCard title="Skill Readiness Overview" icon={BarChart3}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="flex flex-col items-center justify-center">
              <ReadinessRing percentage={readinessPercentage} />
              <p className="text-sm text-muted-foreground mt-2 text-center">
                {met} of {total} target skills met
              </p>
            </div>
            <div className="lg:col-span-2">
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Skills Met", value: met, icon: CheckCircle2, bg: "bg-indigo-50", text: "text-primary" },
                  { label: "In Progress", value: partial, icon: TrendingUp, bg: "bg-indigo-50", text: "text-primary" },
                  { label: "Not Started", value: missing, icon: XCircle, bg: "bg-indigo-50", text: "text-primary" },
                ].map((stat) => (
                  <div key={stat.label} className={`${stat.bg} rounded-xl p-3.5 flex flex-col gap-1`}>
                    <stat.icon className={`h-5 w-5 ${stat.text}`} />
                    <p className={`text-2xl font-extrabold ${stat.text}`}>{stat.value}</p>
                    <p className="text-sm font-semibold text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </div>

              {topGaps.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                    <Zap className="h-3.5 w-3.5 inline mr-1 text-primary" />Priority Focus Areas
                  </p>
                  <div className="space-y-2">
                    {topGaps.map((g) => (
                      <div key={g.skillId} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                        {/* <span className="text-[11px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">-{g.gap}</span> */}
                        <span className="text-sm font-semibold text-secondary flex-1">{g.skillName}</span>
                        <span className="text-xs text-muted-foreground">
                          L{g.currentLevel} → <span className="text-primary font-semibold">L{g.targetLevel}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* 4. Validated Skill Profile */}
      <SectionCard title="Validated Skill Profile" icon={Award}>
        {employee.employeeSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No skills added yet.</p>
        ) : (
          <div className="space-y-2">
            {employee.employeeSkills.map((es) => {
              const sStyle = STATUS_STYLE[es.status];
              return (
                <div key={es.id} className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{es.skill.name}</span>
                      <Badge variant="outline" className="text-[10px] rounded-md border-slate-200 font-medium">
                        {es.skill.category.charAt(0) + es.skill.category.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                    {es.reviewComment && (
                      <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">&quot;{es.reviewComment}&quot;</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Level display */}
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">Self / Validated</p>
                      <p className="text-sm font-bold text-gray-900">
                        {es.selfAssessedLevel}
                        {es.validatedLevel !== null ? ` / ${es.validatedLevel}` : ""}
                        <span className="text-[10px] text-muted-foreground ml-1">
                          {LEVEL_NAMES[es.validatedLevel ?? es.selfAssessedLevel] ?? ""}
                        </span>
                      </p>
                    </div>
                    <Badge variant="secondary" className={`${sStyle.bg} ${sStyle.text} border-0 text-xs font-semibold rounded-lg`}>
                      {sStyle.label}
                    </Badge>
                    {es.evidences.length > 0 && (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 text-[10px] rounded-md">
                        <FileCheck className="h-3 w-3 mr-0.5" />{es.evidences.length}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* 5. Skill Gap Details */}
      {gaps.length > 0 && (
        <SectionCard title="Skill Gap Details" icon={Target}>
          <div className="space-y-2">
            {gaps.map((gap) => (
              <div key={gap.skillId} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                <div className={`h-2 w-2 rounded-full shrink-0 ${
                  gap.status === "met" ? "bg-emerald-400" : gap.status === "partial" ? "bg-amber-400" : "bg-red-400"
                }`} />
                <span className="flex-1 text-sm font-semibold text-gray-900">{gap.skillName}</span>
                <Badge variant="outline" className="text-[10px] border-slate-200 rounded-md">{gap.source}</Badge>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {LEVEL_NAMES[gap.currentLevel] ?? gap.currentLevel}
                    {" → "}
                    <span className="text-primary font-semibold">{LEVEL_NAMES[gap.targetLevel] ?? gap.targetLevel}</span>
                  </span>
                  <Badge
                    variant="secondary"
                    className={`border-0 rounded-lg font-semibold text-[10px] ${
                      gap.status === "met"
                        ? "bg-emerald-50 text-emerald-700"
                        : gap.status === "partial"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {gap.status === "met" ? "Met" : gap.status === "partial" ? "In Progress" : "Not Started"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* 6. Certifications & Assessments */}
      {certifications.length > 0 && (
        <SectionCard title="Certifications & Assessments" icon={Award}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {certifications.map((cert) => (
              <div key={cert.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/60 border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <Award className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{cert.title}</p>
                  <p className="text-xs text-muted-foreground">{cert.skillName}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {cert.score && (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0 font-bold rounded-lg text-xs">
                      {cert.score}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 text-[10px] rounded-md">
                    {cert.type === "CERTIFICATION" ? "Cert" : "Assessment"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Improvement Recommendations */}
      {topGaps.length > 0 && (
        <SectionCard title="Recommended Next Steps" icon={AlertTriangle}>
          <div className="space-y-3">
            {topGaps.map((g, i) => (
              <div key={g.skillId} className="flex items-start gap-3.5 p-4 rounded-xl border border-slate-100 bg-slate-50/40">
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white text-xs font-extrabold">{i + 1}</span>
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">{g.skillName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Close a {g.gap}-level gap: advance from{" "}
                    <strong>{LEVEL_NAMES[g.currentLevel] ?? `Level ${g.currentLevel}`}</strong> to{" "}
                    <strong className="text-primary">{LEVEL_NAMES[g.targetLevel] ?? `Level ${g.targetLevel}`}</strong>.
                    Consider courses, practice projects, or certification to fast-track progress.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {employee.employeeSkills.length === 0 && gaps.length === 0 && (
        <EmptyState icon={FileBarChart} title="No skill data yet" description="Add and validate skills to generate your report." />
      )}
    </div>
  );
}
