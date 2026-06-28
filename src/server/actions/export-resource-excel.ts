"use server";

import { auth } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { buildResourceExcel } from "@/server/services/excel-export.service";

export interface ExcelDownloadResult {
  data: string;   // base64-encoded xlsx bytes
  filename: string;
}

export async function downloadResourceExcel(): Promise<ExcelDownloadResult> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const buf = await buildResourceExcel({ maxAiCalls: 15 });
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const filename = `07_Pipeline_Details_UPDATED_${stamp}.xlsx`;

  return { data: Buffer.from(buf).toString("base64"), filename };
}
