import { PageHeader } from "@/components/shared/page-header";
import { getResourceDashboard } from "@/server/actions/resource-management";
import { ResourceClient } from "./resource-client";

export default async function ResourceManagementPage() {
  const { projects, employees } = await getResourceDashboard();

  const enrichedEmployees = employees.map((emp) => {
    const totalAllocation = emp.allocations.reduce((sum, a) => sum + a.allocation, 0);
    return {
      ...emp,
      totalAllocation,
      availablePercent: Math.max(0, 100 - totalAllocation),
    };
  });

  return (
    <div>
      <PageHeader
        title="Resource Management"
        description="Track project allocations, bench availability, and skill-to-project fit"
      />
      <div className="mt-4">
        <ResourceClient projects={projects} employees={enrichedEmployees} />
      </div>
    </div>
  );
}
