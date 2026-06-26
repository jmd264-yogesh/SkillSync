import { getTeamReports } from "@/server/actions/team-reports";
import { TeamReportsClient } from "./team-reports-client";

export default async function TeamReportsPage() {
  const team = await getTeamReports();
  return <TeamReportsClient team={team} />;
}
