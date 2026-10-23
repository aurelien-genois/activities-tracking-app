import { expect, test } from "@playwright/test";

import {
  activitySummary,
  deleteAllActivities,
  disconnectDb,
  expectToast,
  fillActivityFields,
  insertActivity,
  pastDate,
} from "./helpers";

test.beforeEach(async () => {
  await deleteAllActivities();
});

test.afterEach(async () => {
  await deleteAllActivities();
});

test.afterAll(async () => {
  await disconnectDb();
});

test("User edits an activity successfully", async ({ page }) => {
  const original = {
    date: pastDate(),
    startTime: "14:00",
    endTime: "15:00",
    category: "DOMESTIQUE",
    subcategory: "Courses",
  };
  await insertActivity(original);

  await page.goto("/history");
  await page.getByRole("button", { name: `Edit ${activitySummary(original)}` }).click();

  const dialog = page.getByRole("dialog", { name: "Edit activity" });
  const form = dialog.getByRole("form", { name: "Edit activity" });
  // Pre-filled with the stored values.
  await expect(form.getByLabel("Date")).toHaveValue(original.date);
  await expect(form.getByLabel("Start Time")).toHaveValue(original.startTime);
  await expect(form.getByLabel("End Time")).toHaveValue(original.endTime);
  await expect(
    form.getByRole("group", { name: "Subcategory" }).getByRole("button", { name: "Courses" }),
  ).toHaveAttribute("aria-pressed", "true");

  const updated = {
    ...original,
    endTime: "15:30",
    category: "LOISIR",
    subcategory: "Sport",
    notes: "Running",
  };
  await fillActivityFields(form, updated);
  await form.getByRole("button", { name: "Save changes" }).click();

  await expectToast(page, "Activity updated");
  await expect(dialog).toBeHidden();

  const row = page.getByRole("listitem").filter({ hasText: "LOISIR > Sport" });
  await expect(row).toContainText("14:00 - 15:30");
  await expect(row).toContainText("1h 30m");
  await expect(row).toContainText("Running");
  await expect(page.getByText("DOMESTIQUE > Courses")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `Edit ${activitySummary(updated)}` }),
  ).toBeVisible();
});
