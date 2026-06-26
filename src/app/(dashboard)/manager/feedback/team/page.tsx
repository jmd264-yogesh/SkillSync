import { getTeamAssignmentStatus } from "@/server/actions/feedback-assignment";
import { TeamFeedbackClient } from "./team-feedback-client";

export default async function TeamFeedbackPage() {
  const assignments = await getTeamAssignmentStatus();
  return <TeamFeedbackClient assignments={assignments} />;
}
