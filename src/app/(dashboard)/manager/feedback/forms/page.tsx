import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ManagerFormsClient } from "./manager-forms-client";

export default async function ManagerFormsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.employeeId) redirect("/manager/feedback");

  const [forms, cycles] = await Promise.all([
    db.feedbackForm.findMany({
      where: { createdById: session.user.id, formType: "PM_FEEDBACK" },
      include: {
        reviewCycle: { select: { id: true, name: true, status: true } },
        _count: { select: { assignments: true } },
        sections: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.reviewCycle.findMany({
      where: { status: { in: ["DRAFT", "ACTIVE"] } },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return <ManagerFormsClient forms={forms} cycles={cycles} />;
}
