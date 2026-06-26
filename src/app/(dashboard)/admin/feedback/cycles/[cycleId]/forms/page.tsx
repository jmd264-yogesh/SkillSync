import { notFound } from "next/navigation";
import Link from "next/link";
import { getReviewCycle } from "@/server/actions/review-cycle";
import { getFeedbackFormsForCycle } from "@/server/actions/feedback-form";
import { FormsManagementClient } from "./forms-management-client";

interface Props {
  params: Promise<{ cycleId: string }>;
}

export default async function FormsManagementPage({ params }: Props) {
  const { cycleId } = await params;

  let cycle;
  try {
    cycle = await getReviewCycle(cycleId);
  } catch {
    notFound();
  }

  const forms = await getFeedbackFormsForCycle(cycleId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/feedback/cycles" className="hover:text-primary transition-colors">Feedback Cycles</Link>
        <span>/</span>
        <Link href={`/admin/feedback/cycles/${cycleId}`} className="hover:text-primary transition-colors">{cycle.name}</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Forms</span>
      </div>
      <FormsManagementClient cycle={cycle} forms={forms} />
    </div>
  );
}
