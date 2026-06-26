import { notFound } from "next/navigation";
import Link from "next/link";
import { getReviewCycle } from "@/server/actions/review-cycle";
import { getEmployeeFeedback, getEmployeeSummary } from "@/server/actions/feedback-submission";
import { db } from "@/lib/db";
import { EmployeeFeedbackClient } from "./employee-feedback-client";

interface Props {
  params: Promise<{ cycleId: string; employeeId: string }>;
}

export default async function EmployeeFeedbackPage({ params }: Props) {
  const { cycleId, employeeId } = await params;

  let cycle;
  try {
    cycle = await getReviewCycle(cycleId);
  } catch {
    notFound();
  }

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, employeeCode: true, designation: { select: { name: true } } },
  });
  if (!employee) notFound();

  const [feedback, summary] = await Promise.all([
    getEmployeeFeedback(employeeId, cycleId),
    getEmployeeSummary(employeeId, cycleId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/feedback/cycles" className="hover:text-primary transition-colors">Cycles</Link>
        <span>/</span>
        <Link href={`/admin/feedback/cycles/${cycleId}`} className="hover:text-primary transition-colors">{cycle.name}</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{employee.name}</span>
      </div>
      <EmployeeFeedbackClient
        cycle={{ id: cycle.id, name: cycle.name, status: cycle.status }}
        employee={employee}
        feedback={feedback}
        summary={summary}
      />
    </div>
  );
}
