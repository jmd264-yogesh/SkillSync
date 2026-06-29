import { redirect } from "next/navigation";

// Analytics view is now embedded in the unified Pipeline page
export default function PipelineAnalyticsRedirect() {
  redirect("/admin/resourcing/pipeline");
}

