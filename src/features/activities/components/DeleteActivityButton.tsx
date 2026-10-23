"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { deleteActivity } from "../actions";
import { type EditableActivity } from "./EditActivityDialog";
import { formatTimeRange } from "../time";

export const DELETED_MESSAGE = "Activity deleted";
export const DELETE_ERROR_MESSAGE = "The activity could not be deleted. Please retry.";

export type DeleteActivityButtonProps = {
  activity: Pick<EditableActivity, "id" | "startAt" | "endAt" | "category" | "subcategory">;
  timeZone: string;
};

export function DeleteActivityButton({ activity, timeZone }: DeleteActivityButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const summary = `${formatTimeRange(activity, timeZone)}, ${activity.category} > ${activity.subcategory}`;

  function handleOpenChange(next: boolean) {
    if (!isPending) setOpen(next);
  }

  function handleConfirm() {
    if (isPending) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof deleteActivity>>;
      try {
        result = await deleteActivity(activity.id);
      } catch {
        toast.error(DELETE_ERROR_MESSAGE);
        return;
      }
      setOpen(false);
      if (result.ok) {
        toast.success(DELETED_MESSAGE);
      } else {
        toast.error(result.formError);
      }
      // Also refreshes a stale list (e.g. activity already deleted elsewhere).
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-11 min-w-20 text-base text-destructive hover:text-destructive"
          aria-label={`Delete ${summary}`}
        >
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-1rem)] gap-4 rounded-lg p-4">
        <DialogHeader className="text-left">
          <DialogTitle>Delete activity?</DialogTitle>
          <DialogDescription>{summary}. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-12 text-base"
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
