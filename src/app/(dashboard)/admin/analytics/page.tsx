import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { AnalyticsClient } from "./analytics-client";

export default async function AnalyticsPage() {
  const [
    employees,
    coes,
    designations,
    recentMappingsRaw,
    totalProjects,
  ] = await Promise.all([
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
          select: {
            skillId: true,
            validatedLevel: true,
            skill: { select: { name: true } },
          },
        },
        allocations: {
          select: {
            allocation: true,
            project: { select: { name: true } },
            startDate: true,
            endDate: true,
          },
        },
      },
    }),
    db.coe.findMany({ select: { id: true, name: true } }),
    db.designation.findMany({ select: { id: true, name: true } }),
    db.employeeSkill.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { employee: { select: { name: true } }, skill: { select: { name: true } } },
    }),
    db.project.count(),
  ]);

  const recentMappings = recentMappingsRaw.map((rm) => ({
    id: rm.id,
    employeeName: rm.employee.name,
    skillName: rm.skill.name,
    status: rm.status,
    level: rm.selfAssessedLevel,
  }));

  return (
    <div>
      <PageHeader
        title="Analytics & Reporting"
        description="Interactive resourcing and skill intelligence dashboard"
      />
      <div className="mt-4">
        <AnalyticsClient
          employees={employees}
          coes={coes}
          designations={designations}
          recentMappings={recentMappings}
          totalProjects={totalProjects}
          aiConfigured={false}
        />
      </div>
    </div>
  );
}

