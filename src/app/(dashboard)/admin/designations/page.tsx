import { getDesignations } from "@/server/actions/designation";
import { DesignationsClient } from "./designations-client";

export default async function DesignationsPage() {
  const designations = await getDesignations();
  return <DesignationsClient designations={designations} />;
}
