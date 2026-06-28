import { Suspense } from "react";
import { getHealthRadar } from "@/server/actions/project-health";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Activity } from "lucide-react";
import { HealthClient } from "./health-client";

async function HealthRadarContent() {
  const projects = await getHealthRadar();

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No active projects"
        description="Run the ETL to load project and weekly status data."
      />
    );
  }

  const withFlags = projects.filter((p) => p.ragFlags.length > 0).length;
  const totalLeakage = projects.reduce((s, p) => s + p.leakageHours, 0);
  const totalShadow = projects.reduce((s, p) => s + p.shadowCount, 0);
  const totalReleasable = projects.reduce((s, p) => s + p.releasableFTE, 0);
  const rampDownProjects = projects.filter((p) => p.isRampDown);

  return (
    <HealthClient
      projects={projects}
      withFlags={withFlags}
      totalLeakage={totalLeakage}
      totalShadow={totalShadow}
      totalReleasable={totalReleasable}
      rampDownProjects={rampDownProjects}
    />
  );
}

export default function HealthPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Project Health Radar"
        description="RAG signals from weekly status + timesheet billability leakage + shadow/ghost resource detection."
      />
      <Suspense
        fallback={
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        }
      >
        <HealthRadarContent />
      </Suspense>
    </div>
  );
}
