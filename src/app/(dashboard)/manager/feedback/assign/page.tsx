import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AssignFeedbackClient } from "./assign-feedback-client";

export default async function AssignFeedbackPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.employeeId) redirect("/manager/feedback");

  const [cycles, forms, reportees, projects] = await Promise.all([
    db.reviewCycle.findMany({
      where: { status: { in: ["DRAFT", "ACTIVE"] } },
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
    db.feedbackForm.findMany({
      where: { createdById: session.user.id, formType: "PM_FEEDBACK" },
      select: { id: true, title: true, reviewCycleId: true },
      orderBy: { createdAt: "desc" },
    }),
    db.employee.findMany({
      where: { managerId: session.user.employeeId },
      select: { id: true, name: true, employeeCode: true, designation: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        projectManagerId: true,
        projectManager: { select: { id: true, name: true } },
        allocations: { select: { employeeId: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AssignFeedbackClient
      cycles={cycles}
      forms={forms}
      reportees={reportees}
      projects={projects}
    />
  );
}
