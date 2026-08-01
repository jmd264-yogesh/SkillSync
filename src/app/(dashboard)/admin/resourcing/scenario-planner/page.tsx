import { Suspense } from "react";
import { compareScenariosAction } from "@/server/actions/forecast";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ScenarioPlannerClient } from "./planner-client";

const DEFAULT_SCENARIO_DEFS = [
  { id: "conservative", name: "Conservative", wonStages: ["SOW_SIGNED", "ACTIVE", "RAMP_DOWN"], horizonMonths: 6 },
  { id: "balanced", name: "Balanced", wonStages: ["SOW_PENDING", "SOW_SIGNED", "ACTIVE", "RAMP_DOWN"], horizonMonths: 6 },
  { id: "aggressive", name: "Aggressive", wonStages: ["PROPOSAL", "SOW_PENDING", "SOW_SIGNED", "ACTIVE", "RAMP_DOWN"], horizonMonths: 6 },
];

async function PlannerContent() {
  const initial = await compareScenariosAction({ scenarios: DEFAULT_SCENARIO_DEFS });
  return <ScenarioPlannerClient initial={initial} />;
}

export default function ScenarioPlannerPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Scenario Planner"
        description="Compare 'what-if' pipeline scenarios side by side: assume which deals win, then see revenue, margin, shortfall and hires needed for each."
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-96 w-full" />)}
            </div>
          </div>
        }
      >
        <PlannerContent />
      </Suspense>
    </div>
  );
}
