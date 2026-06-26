import { getCoes } from "@/server/actions/coe";
import { CoeClient } from "./coe-client";

export default async function CoePage() {
  const coes = await getCoes();
  return <CoeClient coes={coes} />;
}
