import { getAllApprovals } from "@/server/actions/approval";
import { ApprovalsClient } from "./approvals-client";

export default async function ApprovalsPage() {
  const submissions = await getAllApprovals();
  return <ApprovalsClient submissions={submissions} />;
}
