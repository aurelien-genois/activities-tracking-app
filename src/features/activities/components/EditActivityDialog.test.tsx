import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateActivity, toastSuccess, refresh } = vi.hoisted(() => ({
  updateActivity: vi.fn(),
  toastSuccess: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../actions", () => ({ updateActivity }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ACTIVITY_MESSAGES } from "../schema";
import {
  activityToFieldValues,
  EditActivityDialog,
  type EditableActivity,
  UPDATE_ERROR_MESSAGE,
  UPDATED_MESSAGE,
} from "./EditActivityDialog";

const TZ = "Europe/Paris";
// 15 Jan 2026 23:30-00:15 UTC -> 16 Jan 00:30-01:15 in Paris (CET).
const activity: EditableActivity = {
  id: "act-1",
  startAt: new Date("2026-01-15T23:30:00Z"),
  endAt: new Date("2026-01-16T00:15:00Z"),
  category: "MANGER",
  subcategory: "Dîner",
  notes: "Dîner tardif",
};

async function openDialog() {
  const user = userEvent.setup();
  render(<EditActivityDialog activity={activity} timeZone={TZ} />);
  await user.click(screen.getByRole("button", { name: /^Edit / }));
  const dialog = screen.getByRole("dialog", { name: "Edit activity" });
  return { user, dialog };
}

const field = (dialog: HTMLElement, label: string) => within(dialog).getByLabelText(label);

describe("activityToFieldValues", () => {
  it("drops an unknown category and maps null notes", () => {
    expect(activityToFieldValues({ ...activity, category: "UNKNOWN", notes: null }, "UTC")).toEqual(
      {
        date: "2026-01-15",
        startTime: "23:30",
        endTime: "00:15",
        category: "",
        subcategory: "Dîner",
        notes: "",
      },
    );
  });
});

describe("EditActivityDialog", () => {
  beforeEach(() => {
    updateActivity.mockReset();
    toastSuccess.mockReset();
    refresh.mockReset();
  });

  it("opens a titled dialog prefilled in the app time zone", async () => {
    const { dialog } = await openDialog();
    expect(dialog).toHaveAccessibleDescription("00:30 - 01:15, MANGER > Dîner");
    expect(field(dialog, "Date")).toHaveValue("2026-01-16");
    expect(field(dialog, "Start Time")).toHaveValue("00:30");
    expect(field(dialog, "End Time")).toHaveValue("01:15");
    expect(field(dialog, "Optional note")).toHaveValue("Dîner tardif");
    const category = within(dialog).getByRole("group", { name: "Category" });
    expect(within(category).getByRole("button", { name: "MANGER" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const sub = within(dialog).getByRole("group", { name: "Subcategory" });
    expect(within(sub).getByRole("button", { name: "Dîner" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("updates the activity, closes, toasts and refreshes", async () => {
    updateActivity.mockResolvedValue({ ok: true, activity: { id: "act-1" } });
    const { user, dialog } = await openDialog();
    await user.clear(field(dialog, "Optional note"));
    await user.type(field(dialog, "Optional note"), "Création");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(updateActivity).toHaveBeenCalledWith("act-1", {
      date: "2026-01-16",
      startTime: "00:30",
      endTime: "01:15",
      category: "MANGER",
      subcategory: "Dîner",
      notes: "Création",
    });
    expect(toastSuccess).toHaveBeenCalledWith(UPDATED_MESSAGE);
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the overlap error from the server and keeps the dialog open", async () => {
    const overlap = "This activity overlaps an existing activity (00:00 - 01:00, TRAVAIL > Job).";
    updateActivity.mockResolvedValue({ ok: false, fieldErrors: {}, formError: overlap });
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(overlap);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("shows server field errors and an unexpected error", async () => {
    updateActivity.mockResolvedValueOnce({
      ok: false,
      fieldErrors: { subcategory: [ACTIVITY_MESSAGES.subcategoryMismatch] },
    });
    updateActivity.mockRejectedValueOnce(new Error("network"));
    const { user, dialog } = await openDialog();
    const save = within(dialog).getByRole("button", { name: "Save changes" });

    await user.click(save);
    expect(await within(dialog).findByText(ACTIVITY_MESSAGES.subcategoryMismatch)).toBeVisible();

    await user.click(save);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(UPDATE_ERROR_MESSAGE);
  });

  it("validates on the client without calling the server", async () => {
    const { user, dialog } = await openDialog();
    await user.clear(field(dialog, "End Time"));
    await user.type(field(dialog, "End Time"), "00:10");
    await user.click(within(dialog).getByRole("button", { name: "TRAVAIL" }));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(within(dialog).getByText(ACTIVITY_MESSAGES.endBeforeStart)).toBeVisible();
    expect(within(dialog).getByText(ACTIVITY_MESSAGES.subcategoryRequired)).toBeVisible();
    expect(field(dialog, "End Time")).toHaveAttribute("aria-invalid", "true");
    expect(updateActivity).not.toHaveBeenCalled();

    // Editing a field clears its error.
    await user.clear(field(dialog, "End Time"));
    await user.type(field(dialog, "End Time"), "01:00");
    expect(within(dialog).queryByText(ACTIVITY_MESSAGES.endBeforeStart)).not.toBeInTheDocument();
  });

  it("rejects a future activity on the client", async () => {
    const { user, dialog } = await openDialog();
    await user.clear(field(dialog, "Date"));
    await user.type(field(dialog, "Date"), "2099-01-01");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(ACTIVITY_MESSAGES.future);
    expect(updateActivity).not.toHaveBeenCalled();
  });

  it("discards abandoned edits when reopened", async () => {
    const { user, dialog } = await openDialog();
    await user.clear(field(dialog, "Optional note"));
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Edit / }));
    expect(screen.getByLabelText("Optional note")).toHaveValue("Dîner tardif");
  });

  it("disables the form and prevents double submit while saving", async () => {
    let resolve!: (value: unknown) => void;
    updateActivity.mockReturnValue(new Promise((r) => (resolve = r)));
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    const saving = within(dialog).getByRole("button", { name: "Saving…" });
    expect(saving).toBeDisabled();
    expect(field(dialog, "Date")).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(updateActivity).toHaveBeenCalledTimes(1);

    resolve({ ok: true, activity: { id: "act-1" } });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
