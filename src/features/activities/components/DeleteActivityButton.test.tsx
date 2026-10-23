import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteActivity, toastSuccess, toastError, refresh } = vi.hoisted(() => ({
  deleteActivity: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../actions", () => ({ deleteActivity }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import {
  DELETE_ERROR_MESSAGE,
  DELETED_MESSAGE,
  DeleteActivityButton,
} from "./DeleteActivityButton";

const activity = {
  id: "act-1",
  startAt: new Date("2026-01-15T08:00:00Z"),
  endAt: new Date("2026-01-15T09:00:00Z"),
  category: "TRAVAIL",
  subcategory: "Création",
};

async function openConfirm() {
  const user = userEvent.setup();
  render(<DeleteActivityButton activity={activity} timeZone="Europe/Paris" />);
  await user.click(
    screen.getByRole("button", { name: "Delete 09:00 - 10:00, TRAVAIL > Création" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Delete activity?" });
  return { user, dialog };
}

describe("DeleteActivityButton", () => {
  beforeEach(() => {
    deleteActivity.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    refresh.mockReset();
  });

  it("asks for confirmation; cancel does nothing", async () => {
    const { user, dialog } = await openConfirm();
    expect(dialog).toHaveAccessibleDescription(
      "09:00 - 10:00, TRAVAIL > Création. This cannot be undone.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteActivity).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("deletes after confirmation, toasts and refreshes", async () => {
    deleteActivity.mockResolvedValue({ ok: true });
    const { user, dialog } = await openConfirm();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(deleteActivity).toHaveBeenCalledWith("act-1");
    expect(toastSuccess).toHaveBeenCalledWith(DELETED_MESSAGE);
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the server error (e.g. not found) and refreshes", async () => {
    const notFound = "Activity not found. It may have been deleted.";
    deleteActivity.mockResolvedValue({ ok: false, formError: notFound });
    const { user, dialog } = await openConfirm();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(notFound));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a generic error when the action fails and keeps the dialog open", async () => {
    deleteActivity.mockRejectedValue(new Error("network"));
    const { user, dialog } = await openConfirm();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(DELETE_ERROR_MESSAGE));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("prevents double submit while deleting", async () => {
    let resolve!: (value: unknown) => void;
    deleteActivity.mockReturnValue(new Promise((r) => (resolve = r)));
    const { user, dialog } = await openConfirm();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    const deleting = within(dialog).getByRole("button", { name: "Deleting…" });
    expect(deleting).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(deleteActivity).toHaveBeenCalledTimes(1);

    resolve({ ok: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
