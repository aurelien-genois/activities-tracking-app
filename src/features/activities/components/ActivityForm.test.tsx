import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { nowTimeInTz, todayInTz } from "@/lib/datetime";

const { createActivity, toastSuccess } = vi.hoisted(() => ({
  createActivity: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("../actions", () => ({ createActivity }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

import { ActivityForm } from "./ActivityForm";
import { type ActivityFieldValues } from "./ActivityFields";

const TZ = "Europe/Paris";

const initialValues: ActivityFieldValues = {
  date: "2026-01-15",
  startTime: "09:00",
  endTime: "10:00",
  category: "",
  subcategory: "",
  notes: "",
};

function renderForm(values: Partial<ActivityFieldValues> = {}) {
  const user = userEvent.setup();
  render(<ActivityForm initialValues={{ ...initialValues, ...values }} timeZone={TZ} />);
  return { user };
}

const categoryGroup = () => screen.getByRole("group", { name: "Category" });
const subcategoryGroup = () => screen.getByRole("group", { name: "Subcategory" });
const chip = (group: HTMLElement, name: string) => within(group).getByRole("button", { name });
const saveButton = () => screen.getByRole("button", { name: /^(Save|Saving…)$/ });

async function selectActivity(
  user: ReturnType<typeof userEvent.setup>,
  category: string,
  sub: string,
) {
  await user.click(chip(categoryGroup(), category));
  await user.click(chip(subcategoryGroup(), sub));
}

describe("ActivityForm", () => {
  beforeEach(() => {
    createActivity.mockReset();
    toastSuccess.mockReset();
  });

  it("renders labelled fields with the initial values", () => {
    renderForm();
    expect(screen.getByLabelText("Date")).toHaveValue("2026-01-15");
    expect(screen.getByLabelText("Start Time")).toHaveValue("09:00");
    expect(screen.getByLabelText("End Time")).toHaveValue("10:00");
    expect(screen.getByLabelText("Optional note")).toHaveAttribute("maxLength", "1000");
    expect(within(categoryGroup()).getAllByRole("button")).toHaveLength(6);
    expect(screen.queryByRole("group", { name: "Subcategory" })).not.toBeInTheDocument();
    expect(screen.getByText("Select a category first.")).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it("selects a single category at a time", async () => {
    const { user } = renderForm();
    await user.click(chip(categoryGroup(), "MANGER"));
    expect(chip(categoryGroup(), "MANGER")).toHaveAttribute("aria-pressed", "true");

    await user.click(chip(categoryGroup(), "TRAVAIL"));
    expect(chip(categoryGroup(), "TRAVAIL")).toHaveAttribute("aria-pressed", "true");
    expect(chip(categoryGroup(), "MANGER")).toHaveAttribute("aria-pressed", "false");
    expect(within(categoryGroup()).getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  it("only shows the subcategories of the selected category", async () => {
    const { user } = renderForm();
    await user.click(chip(categoryGroup(), "TRAVAIL"));
    const names = within(subcategoryGroup())
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(names).toEqual(["Job", "Formation", "Création"]);

    await user.click(chip(subcategoryGroup(), "Job"));
    await user.click(chip(subcategoryGroup(), "Création"));
    expect(within(subcategoryGroup()).getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(chip(subcategoryGroup(), "Création")).toHaveAttribute("aria-pressed", "true");
  });

  it("resets the subcategory when the category changes", async () => {
    const { user } = renderForm();
    await selectActivity(user, "TRAVAIL", "Job");

    await user.click(chip(categoryGroup(), "TRAVAIL"));
    expect(chip(subcategoryGroup(), "Job")).toHaveAttribute("aria-pressed", "true");

    await user.click(chip(categoryGroup(), "LOISIR"));
    expect(within(subcategoryGroup()).queryByRole("button", { name: "Job" })).toBeNull();
    expect(within(subcategoryGroup()).queryAllByRole("button", { pressed: true })).toHaveLength(0);

    await user.click(chip(categoryGroup(), "TRAVAIL"));
    expect(chip(subcategoryGroup(), "Job")).toHaveAttribute("aria-pressed", "false");
  });

  it("shows required category and subcategory messages without submitting", async () => {
    const { user } = renderForm();
    await user.click(saveButton());

    expect(screen.getByText("Category is required.")).toBeInTheDocument();
    expect(screen.getByText("Subcategory is required.")).toBeInTheDocument();
    expect(categoryGroup()).toHaveAccessibleDescription("Category is required.");
    expect(createActivity).not.toHaveBeenCalled();

    // Fixing a field clears its message.
    await user.click(chip(categoryGroup(), "REPOS"));
    expect(screen.queryByText("Category is required.")).not.toBeInTheDocument();
    expect(subcategoryGroup()).toHaveAccessibleDescription("Subcategory is required.");
  });

  it("shows an error when the end time is before the start time", async () => {
    const { user } = renderForm();
    await selectActivity(user, "REPOS", "Douche");
    fireEvent.change(screen.getByLabelText("End Time"), { target: { value: "08:30" } });
    await user.click(saveButton());

    const endTime = screen.getByLabelText("End Time");
    expect(endTime).toHaveAttribute("aria-invalid", "true");
    expect(endTime).toHaveAccessibleDescription("End time must be after start time.");
    expect(createActivity).not.toHaveBeenCalled();
  });

  it("shows an error when the notes are too long", async () => {
    const { user } = renderForm();
    await selectActivity(user, "REPOS", "Douche");
    fireEvent.change(screen.getByLabelText("Optional note"), {
      target: { value: "x".repeat(1001) },
    });
    await user.click(saveButton());

    expect(screen.getByLabelText("Optional note")).toHaveAccessibleDescription(
      "Notes must be at most 1000 characters.",
    );
    expect(createActivity).not.toHaveBeenCalled();
  });

  it("blocks future activities on the client", async () => {
    const { user } = renderForm({ date: "2999-01-01" });
    await selectActivity(user, "REPOS", "Douche");
    await user.click(saveButton());

    expect(screen.getByRole("alert")).toHaveTextContent("Activity cannot be in the future.");
    expect(createActivity).not.toHaveBeenCalled();
  });

  it("saves, shows a toast and resets the form for the next activity", async () => {
    createActivity.mockResolvedValue({ ok: true, activity: { id: "a1" } });
    const { user } = renderForm();
    await selectActivity(user, "TRAVAIL", "Job");
    await user.type(screen.getByLabelText("Optional note"), "Weekly sync");
    await user.click(saveButton());

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Activity saved"));
    // The toast fires inside the transition: wait for it to settle before asserting the reset.
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(createActivity).toHaveBeenCalledWith({
      ...initialValues,
      category: "TRAVAIL",
      subcategory: "Job",
      notes: "Weekly sync",
    });

    const now = new Date();
    expect(screen.getByLabelText("Date")).toHaveValue(todayInTz(now, TZ));
    expect(screen.getByLabelText("Start Time")).toHaveValue("10:00");
    // Allow a minute boundary between the reset and this assertion.
    expect([nowTimeInTz(now, TZ), nowTimeInTz(new Date(now.getTime() - 60_000), TZ)]).toContain(
      (screen.getByLabelText("End Time") as HTMLInputElement).value,
    );
    expect(within(categoryGroup()).queryAllByRole("button", { pressed: true })).toHaveLength(0);
    expect(screen.queryByRole("group", { name: "Subcategory" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Optional note")).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it("displays the overlap error returned by the action and keeps the values", async () => {
    const overlap = "This activity overlaps an existing activity (09:30 - 10:30, MANGER > Dej).";
    createActivity.mockResolvedValue({ ok: false, fieldErrors: {}, formError: overlap });
    const { user } = renderForm();
    await selectActivity(user, "TRAVAIL", "Job");
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(overlap);
    expect(chip(subcategoryGroup(), "Job")).toHaveAttribute("aria-pressed", "true");
    expect(toastSuccess).not.toHaveBeenCalled();

    // Editing the form clears the stale error.
    fireEvent.change(screen.getByLabelText("Start Time"), { target: { value: "08:00" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("displays field errors returned by the action", async () => {
    createActivity.mockResolvedValue({
      ok: false,
      fieldErrors: { startTime: ["Start time does not exist on this date."] },
    });
    const { user } = renderForm();
    await selectActivity(user, "TRAVAIL", "Job");
    await user.click(saveButton());

    await waitFor(() =>
      expect(screen.getByLabelText("Start Time")).toHaveAccessibleDescription(
        "Start time does not exist on this date.",
      ),
    );
  });

  it("shows a retry message when the action throws", async () => {
    createActivity.mockRejectedValue(new Error("network"));
    const { user } = renderForm();
    await selectActivity(user, "TRAVAIL", "Job");
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The activity could not be saved. Please retry.",
    );
  });

  it("disables submit and fields while saving", async () => {
    let resolve: (value: unknown) => void = () => {};
    createActivity.mockReturnValue(new Promise((r) => (resolve = r)));
    const { user } = renderForm();
    await selectActivity(user, "TRAVAIL", "Job");
    await user.click(saveButton());

    const pending = await screen.findByRole("button", { name: "Saving…" });
    expect(pending).toBeDisabled();
    expect(screen.getByLabelText("Date")).toBeDisabled();
    expect(chip(categoryGroup(), "MANGER")).toBeDisabled();
    fireEvent.submit(pending.closest("form")!);
    expect(createActivity).toHaveBeenCalledTimes(1);

    resolve({ ok: true, activity: { id: "a1" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  });
});
