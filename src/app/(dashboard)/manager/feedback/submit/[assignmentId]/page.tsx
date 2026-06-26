import { notFound } from "next/navigation";
import Link from "next/link";
import { getAssignment } from "@/server/actions/feedback-assignment";
import { FeedbackSubmitClient } from "./feedback-submit-client";

interface Props {
  params: Promise<{ assignmentId: string }>;
}

export default async function FeedbackSubmitPage({ params }: Props) {
  const { assignmentId } = await params;

  let assignment;
  try {
    assignment = await getAssignment(assignmentId);
  } catch {
    notFound();
  }

  if (assignment.submission) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <p className="text-lg font-semibold text-slate-900 mb-2">Feedback already submitted</p>
          <p className="text-sm text-muted-foreground mb-4">
            You submitted feedback for {assignment.employee.name} on{" "}
            {new Date(assignment.submission.submittedAt).toLocaleDateString("en-IN", {
              day: "2-digit", month: "short", year: "numeric",
            })}.
          </p>
          <Link href="/manager/feedback" className="text-sm text-primary underline underline-offset-2">
            Back to Feedback
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/manager/feedback" className="hover:text-primary transition-colors">Feedback</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Submit for {assignment.employee.name}</span>
      </div>
      <FeedbackSubmitClient assignment={assignment} />
    </div>
  );
}
