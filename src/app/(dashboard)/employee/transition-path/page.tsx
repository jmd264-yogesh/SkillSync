import { getDesignationsForTransition } from "@/server/actions/transition-path";
import { TransitionClient } from "./transition-client";

export default async function TransitionPathPage() {
  const designations = await getDesignationsForTransition();
  return <TransitionClient designations={designations} />;
}
