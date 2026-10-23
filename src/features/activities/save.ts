import type { Activity, Prisma } from "@/generated/prisma/client";

import { type ConflictingActivity, findOverlap } from "./overlap";

/** Total attempts: the first one plus up to 3 retries on serialization failures. */
export const MAX_SAVE_ATTEMPTS = 4;

export type ActivityData = Pick<
  Prisma.ActivityUncheckedCreateInput,
  "category" | "subcategory" | "notes"
> & {
  startAt: Date;
  endAt: Date;
};

type TransactionClient = Pick<Prisma.TransactionClient, "activity">;

export type TransactionRunner = {
  $transaction<R>(
    fn: (tx: TransactionClient) => Promise<R>,
    options: { isolationLevel: Prisma.TransactionIsolationLevel },
  ): Promise<R>;
};

export type SaveActivityResult =
  | { ok: true; activity: Activity }
  | { ok: false; reason: "overlap"; conflict: ConflictingActivity }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "conflict-retry" };

export function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === code
  );
}

/**
 * Serialization failure (SQLSTATE 40001). Prisma maps it to `P2034` when it
 * happens during a query, but with `@prisma/adapter-pg` a failure at COMMIT
 * surfaces as a raw `DriverAdapterError` whose `cause.kind` is
 * `TransactionWriteConflict` (observed with Prisma 7.10).
 */
export function isSerializationFailure(error: unknown): boolean {
  if (hasPrismaCode(error, "P2034")) return true;
  const cause: unknown =
    typeof error === "object" && error !== null ? Reflect.get(error, "cause") : null;
  return (
    typeof cause === "object" &&
    cause !== null &&
    (Reflect.get(cause, "kind") === "TransactionWriteConflict" ||
      Reflect.get(cause, "originalCode") === "40001")
  );
}

/**
 * Overlap check + create (or update when `id` is given) in one serializable
 * transaction, retried on serialization failures.
 */
export async function saveActivity(
  client: TransactionRunner,
  data: ActivityData,
  id?: string,
): Promise<SaveActivityResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await client.$transaction(
        async (tx): Promise<SaveActivityResult> => {
          if (id && !(await tx.activity.findUnique({ where: { id }, select: { id: true } }))) {
            return { ok: false, reason: "not-found" };
          }
          const conflict = await findOverlap(tx, {
            startAt: data.startAt,
            endAt: data.endAt,
            excludeId: id,
          });
          if (conflict) return { ok: false, reason: "overlap", conflict };
          const activity = id
            ? await tx.activity.update({ where: { id }, data })
            : await tx.activity.create({ data });
          return { ok: true, activity };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (isSerializationFailure(error)) {
        if (attempt < MAX_SAVE_ATTEMPTS) continue;
        return { ok: false, reason: "conflict-retry" };
      }
      if (hasPrismaCode(error, "P2025")) return { ok: false, reason: "not-found" };
      throw error;
    }
  }
}
