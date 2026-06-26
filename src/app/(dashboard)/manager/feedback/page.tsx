import { getMyAssignments } from "@/server/actions/feedback-assignment";
import { ManagerFeedbackClient } from "./manager-feedback-client";

export default async function ManagerFeedbackPage() {
  const assignments = await getMyAssignments();
  return <ManagerFeedbackClient assignments={assignments} />;
}
