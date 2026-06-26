import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { AnalyticsClient } from "./analytics-client";
import { computeReadiness } from "@/server/services/readiness.service";

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
    .map((emp) => ({
      name: emp.name,
      coeId: emp.coeId,
      coeSkills: emp.coe?.coeSkills ?? [],
      designationSkills: emp.designation?.designationSkills ?? [],
      readiness: computeReadiness(emp.coe?.coeSkills ?? [], emp.designation?.designationSkills ?? [], emp.employeeSkills).percentage,
    }))
    .filter((e) => e.coeSkills.length > 0 || e.designationSkills.length > 0);

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
    const score = computeReadiness(emp.coe.coeSkills, emp.designation?.designationSkills ?? [], emp.employeeSkills).percentage;
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
