import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { AnalyticsClient } from "./analytics-client";

type EmployeeWithReadinessData = {
  coe: {
    name: string;
    coeSkills: { skillId: string; targetCompetency: number }[];
  } | null;
  designation: {
    name: string;
    designationSkills: { skillId: string; targetCompetency: number }[];
  } | null;
  employeeSkills: { skillId: string; validatedLevel: number | null }[];
};

function computeEmployeeReadiness(emp: EmployeeWithReadinessData): number {
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

export default async function AnalyticsPage() {
  const [
    totalEmployees,
    totalSkillsMapped,
    totalCoes,
    totalDesignations,
    coes,
    designations,
    approvals,
    recentMappingsRaw,
    allEmployeesWithProfiles,
  ] = await Promise.all([
    db.employee.count(),
    db.employeeSkill.count(),
    db.coe.count(),
    db.designation.count(),
    db.coe.findMany({ select: { name: true, _count: { select: { employees: true } } } }),
    db.designation.findMany({ select: { name: true, _count: { select: { employees: true } } } }),
    db.employeeSkill.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.employeeSkill.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { employee: { select: { name: true } }, skill: { select: { name: true } } },
    }),
    db.employee.findMany({
      include: {
        coe: {
          select: {
            name: true,
            coeSkills: { select: { skillId: true, targetCompetency: true } },
          },
        },
        designation: {
          select: {
            name: true,
            designationSkills: { select: { skillId: true, targetCompetency: true } },
          },
        },
        employeeSkills: {
          where: { status: "APPROVED" },
          select: { skillId: true, validatedLevel: true },
        },
      },
    }),
  ]);

  const coeData = coes.map((c) => ({
    name: c.name,
    count: c._count.employees,
  }));

  const designationData = designations.map((d) => ({
    name: d.name,
    count: d._count.employees,
  }));

  const approvalData = approvals.map((a) => ({
    status: a.status,
    count: a._count.status,
  }));

  const recentMappings = recentMappingsRaw.map((rm) => ({
    id: rm.id,
    employeeName: rm.employee.name,
    skillName: rm.skill.name,
    status: rm.status,
    level: rm.selfAssessedLevel,
  }));

  const readinessScores = allEmployeesWithProfiles
    .map((emp) => ({ name: emp.name, coeId: emp.coeId, readiness: computeEmployeeReadiness(emp) }))
    .filter((e) => {
      const hasTargets =
        (allEmployeesWithProfiles.find((x) => x.name === e.name)?.coe?.coeSkills.length ?? 0) > 0 ||
        (allEmployeesWithProfiles.find((x) => x.name === e.name)?.designation?.designationSkills.length ?? 0) > 0;
      return hasTargets;
    });

  const orgReadiness =
    readinessScores.length > 0
      ? Math.round(readinessScores.reduce((s, e) => s + e.readiness, 0) / readinessScores.length)
      : 0;

  const employeesWithNoGaps = readinessScores.filter((e) => e.readiness === 100).length;

  const readinessBands = {
    low: readinessScores.filter((e) => e.readiness < 40).length,
    medium: readinessScores.filter((e) => e.readiness >= 40 && e.readiness <= 70).length,
    high: readinessScores.filter((e) => e.readiness > 70).length,
  };

  const coeReadinessMap = new Map<string, number[]>();
  for (const emp of allEmployeesWithProfiles) {
    if (!emp.coe) continue;
    const score = computeEmployeeReadiness(emp);
    const existing = coeReadinessMap.get(emp.coe.name) ?? [];
    existing.push(score);
    coeReadinessMap.set(emp.coe.name, existing);
  }

  const coeReadinessData = Array.from(coeReadinessMap.entries()).map(([name, scores]) => ({
    name,
    readiness: scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0,
  }));

  return (
    <div>
      <PageHeader
        title="Analytics & Reporting"
        description="Organization-wide skill insights and workforce metrics"
      />
      <div className="mt-4">
        <AnalyticsClient
          metrics={{ totalEmployees, totalSkillsMapped, totalCoes, totalDesignations }}
          coeData={coeData}
          designationData={designationData}
          approvalData={approvalData}
          recentMappings={recentMappings}
          orgReadiness={orgReadiness}
          employeesWithNoGaps={employeesWithNoGaps}
          readinessBands={readinessBands}
          coeReadinessData={coeReadinessData}
        />
      </div>
    </div>
  );
}
