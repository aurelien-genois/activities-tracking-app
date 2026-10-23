"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import type { Activity } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

import { type ActivityFieldErrors, activityFormSchema, getFieldErrors } from "./schema";
import { hasPrismaCode, saveActivity } from "./save";
import { formatTimeRange, toActivityInterval } from "./time";

export type ActivityActionResult =
  | { ok: true; activity: Activity }
  | { ok: false; fieldErrors: ActivityFieldErrors; formError?: string };

export type DeleteActivityResult = { ok: true } | { ok: false; formError: string };

const UNAUTHORIZED_MESSAGE = "You must be signed in.";
const NOT_FOUND_MESSAGE = "Activity not found. It may have been deleted.";
const RETRY_MESSAGE =
  "The activity could not be saved because of a concurrent change. Please retry.";

function failure(formError: string): {
  ok: false;
  fieldErrors: ActivityFieldErrors;
  formError: string;
} {
  return { ok: false, fieldErrors: {}, formError };
}

async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return Boolean(session?.user);
}

function toPlainObject(input: unknown): unknown {
  return input instanceof FormData ? Object.fromEntries(input.entries()) : input;
}

function isValidId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 64;
}

function revalidateActivityPages(): void {
  revalidatePath("/");
  revalidatePath("/history");
}

async function upsertActivity(input: unknown, id?: string): Promise<ActivityActionResult> {
  if (!(await isAuthenticated())) return failure(UNAUTHORIZED_MESSAGE);
  if (id !== undefined && !isValidId(id)) return failure(NOT_FOUND_MESSAGE);

  const parsed = activityFormSchema.safeParse(toPlainObject(input));
  if (!parsed.success) {
    const formError = parsed.error.issues.find((issue) => issue.path.length === 0)?.message;
    return { ok: false, fieldErrors: getFieldErrors(parsed.error), formError };
  }

  const timeZone = getEnv().APP_TIMEZONE;
  const interval = toActivityInterval(parsed.data, timeZone, new Date());
  if (!interval.ok) return interval;

  const { category, subcategory, notes } = parsed.data;
  const result = await saveActivity(
    prisma,
    {
      startAt: interval.startAt,
      endAt: interval.endAt,
      category,
      subcategory,
      notes: notes ?? null,
    },
    id,
  );

  if (result.ok) {
    revalidateActivityPages();
    return { ok: true, activity: result.activity };
  }
  switch (result.reason) {
    case "overlap": {
      const { conflict } = result;
      return failure(
        `This activity overlaps an existing activity (${formatTimeRange(conflict, timeZone)}, ` +
          `${conflict.category} > ${conflict.subcategory}).`,
      );
    }
    case "not-found":
      return failure(NOT_FOUND_MESSAGE);
    case "conflict-retry":
      return failure(RETRY_MESSAGE);
  }
}

export async function createActivity(input: unknown): Promise<ActivityActionResult> {
  return upsertActivity(input);
}

export async function updateActivity(id: string, input: unknown): Promise<ActivityActionResult> {
  return upsertActivity(input, id);
}

export async function deleteActivity(id: string): Promise<DeleteActivityResult> {
  if (!(await isAuthenticated())) return { ok: false, formError: UNAUTHORIZED_MESSAGE };
  if (!isValidId(id)) return { ok: false, formError: NOT_FOUND_MESSAGE };
  try {
    await prisma.activity.delete({ where: { id } });
  } catch (error) {
    if (hasPrismaCode(error, "P2025")) return { ok: false, formError: NOT_FOUND_MESSAGE };
    throw error;
  }
  revalidateActivityPages();
  return { ok: true };
}
