"use server";

import { auth } from "@/lib/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import {
  getExtensionForecasts,
  getExtensionSummary,
  updateForecastOverride,
} from "@/server/services/extension-forecast.service";
import type {
  ExtensionForecastRow,
  ExtensionSummary,
} from "@/server/services/extension-forecast.service";

export async function getExtensionForecastData(filters?: {
  cluster?: string;
  level?: string;
  band?: string;
}): Promise<ExtensionForecastRow[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();
  return getExtensionForecasts(filters);
}

export async function getExtensionSummaryData(): Promise<ExtensionSummary> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();
  return getExtensionSummary();
}

export async function setExtensionForecastOverride(params: {
  id: string;
  overrideStatus: string | null;
  overrideNotes?: string | null;
}): Promise<ExtensionForecastRow> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const updated = await updateForecastOverride(params);

  revalidatePath("/admin/resourcing/extension");
  revalidatePath("/admin/resourcing/simulator");
  revalidatePath("/admin/resourcing/match");

  return updated;
}
