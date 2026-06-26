import { notFound } from "next/navigation";
import Link from "next/link";
import { getReviewCycle, getCycleEmployeeStatus } from "@/server/actions/review-cycle";
import { CycleDetailClient } from "./cycle-detail-client";

interface Props {
  params: Promise<{ cycleId: string }>;
}

export default async function CycleDetailPage({ params }: Props) {
  const { cycleId } = await params;

  let cycle;
  try {
    cycle = await getReviewCycle(cycleId);
  } catch {
    notFound();
  }

  const assignments = await getCycleEmployeeStatus(cycleId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/feedback/cycles" className="hover:text-primary transition-colors">
          Feedback Cycles
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{cycle.name}</span>
      </div>
      <CycleDetailClient cycle={cycle} assignments={assignments} />
    </div>
  );
}
