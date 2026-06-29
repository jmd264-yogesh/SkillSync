import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { QuestionnaireClient } from "./questionnaire-client";

export default async function QuestionnairePage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/login");

  const [skills, designations, coes] = await Promise.all([
    db.skill.findMany({ select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
    db.designation.findMany({ select: { id: true, name: true, level: true }, orderBy: { level: "asc" } }),
    db.coe.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">PM Resource Planning Questionnaire</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Describe your project and requirements — we&apos;ll rank all available resources against every relevant signal.
        </p>
      </div>
      <QuestionnaireClient skills={skills} designations={designations} coes={coes} />
    </div>
  );
}
