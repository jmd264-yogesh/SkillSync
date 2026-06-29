import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { SimulatorClient } from "./simulator-client";

export default async function SimulatorPage() {
  const skills = await db.skill.findMany({
    select: { id: true, name: true, category: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Capacity Simulator"
        description="Model demand for new projects by category and headcount. See shortfall by role and redeployment candidates."
      />
      <SimulatorClient skills={skills} />
    </div>
  );
}
