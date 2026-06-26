import { PageHeader } from "@/components/shared/page-header";
import { SimulatorClient } from "./simulator-client";

export default function SimulatorPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Capacity Simulator"
        description="Model demand for new projects by category and headcount. See shortfall by role and redeployment candidates."
      />
      <SimulatorClient />
    </div>
  );
}
