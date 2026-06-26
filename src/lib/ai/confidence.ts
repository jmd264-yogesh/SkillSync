import { db } from "@/lib/db";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface ConfidenceResult {
  level: ConfidenceLevel;
  percentage: number;
  explanation: string;
  improvements: string[];
}

/**
 * Compute data coverage confidence from IngestReport + DB state.
 * HIGH ≥ 80%, MEDIUM 50–79%, LOW < 50%
 */
export async function computeDataCoverage(): Promise<ConfidenceResult> {
  const [
    totalEmployees,
    employeesWithSkills,
    employeesWithCompetencies,
    totalTimesheetRows,
    timesheetsWithBillable,
    projectsWithRoleMix,
    totalProjects,
  ] = await Promise.all([
    db.employee.count(),
    db.employee.count({ where: { employeeSkills: { some: {} } } }),
    db.employee.count({ where: { competencies: { some: {} } } }),
    db.timesheet.count(),
    db.timesheet.count({ where: { isBillable: true } }),
    db.project.count({ where: { category: { not: "OTHER" } } }),
    db.project.count(),
  ]);

  const improvements: string[] = [];
  let score = 0;
  let checks = 0;

  // Check 1: skill coverage
  const skillCov = totalEmployees > 0 ? employeesWithSkills / totalEmployees : 0;
  score += skillCov; checks++;
  if (skillCov < 0.8) improvements.push(`${Math.round((1 - skillCov) * 100)}% of employees lack skill records`);

  // Check 2: competency coverage
  const compCov = totalEmployees > 0 ? employeesWithCompetencies / totalEmployees : 0;
  score += compCov; checks++;
  if (compCov < 0.8) improvements.push(`${Math.round((1 - compCov) * 100)}% of employees lack competency assessments`);

  // Check 3: timesheet billability field quality
  const billCov = totalTimesheetRows > 0 ? timesheetsWithBillable / totalTimesheetRows : 0;
  score += billCov; checks++;
  if (billCov < 0.9) improvements.push("Some timesheet rows have missing is_billable values (defaulted to false)");

  // Check 4: project category coverage
  const catCov = totalProjects > 0 ? projectsWithRoleMix / totalProjects : 0;
  score += catCov; checks++;
  if (catCov < 0.8) improvements.push(`${Math.round((1 - catCov) * 100)}% of projects mapped to OTHER category — update type_of_project`);

  const percentage = checks > 0 ? Math.round((score / checks) * 100) : 0;
  const level: ConfidenceLevel = percentage >= 80 ? "HIGH" : percentage >= 50 ? "MEDIUM" : "LOW";

  return {
    level,
    percentage,
    explanation: `Data coverage: ${percentage}% across skill records, competency assessments, timesheet quality, and project categorization.`,
    improvements,
  };
}
