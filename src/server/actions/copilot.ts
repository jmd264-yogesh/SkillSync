"use server";

import { auth } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { runCopilotTurn } from "@/lib/ai/copilot/agent";
import { copilotTurnSchema } from "@/validations/resourcing.schema";
import type { CopilotMessage } from "@/lib/ai/copilot/agent";

export async function sendCopilotMessage(input: unknown): Promise<{ reply: string }> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) throw new ForbiddenError();

  const { history } = copilotTurnSchema.parse(input);
  const reply = await runCopilotTurn(history as CopilotMessage[]);
  return { reply };
}
