import type { Prisma } from "@/generated/prisma/client";

import { type ActivityInterval } from "./time";

/** Half-open intervals overlap; back-to-back activities (a.end === b.start) do not. */
export function overlaps(a: ActivityInterval, b: ActivityInterval): boolean {
  return a.startAt < b.endAt && a.endAt > b.startAt;
}

export type OverlapClient = {
  activity: Pick<Prisma.TransactionClient["activity"], "findFirst">;
};

export type OverlapQuery = ActivityInterval & { excludeId?: string };

export const conflictSelect = {
  id: true,
  startAt: true,
  endAt: true,
  category: true,
  subcategory: true,
} as const satisfies Prisma.ActivitySelect;

export type ConflictingActivity = Prisma.ActivityGetPayload<{ select: typeof conflictSelect }>;

/** First stored activity overlapping the interval (optionally excluding one id), or null. */
export function findOverlap(
  client: OverlapClient,
  { startAt, endAt, excludeId }: OverlapQuery,
): Promise<ConflictingActivity | null> {
  return client.activity.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    orderBy: { startAt: "asc" },
    select: conflictSelect,
  });
}
