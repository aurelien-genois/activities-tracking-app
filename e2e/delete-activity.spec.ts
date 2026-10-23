import { expect, test } from "@playwright/test";

import {
  activitySummary,
  countActivities,
  deleteAllActivities,
  disconnectDb,
  expectToast,
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

test("User deletes an activity successfully", async ({ page }) => {
  const date = pastDate();
  const kept = {
    date,
    startTime: "08:00",
    endTime: "08:30",
    category: "MANGER",
    subcategory: "Ptit-dej",
  };
  const removed = {
    date,
    startTime: "12:00",
    endTime: "13:00",
    category: "MANGER",
    subcategory: "Dej",
  };
  await insertActivity(kept);
  await insertActivity(removed);

  await page.goto("/history");
  await expect(page.getByText("MANGER > Dej")).toBeVisible();
  await page.getByRole("button", { name: `Delete ${activitySummary(removed)}` }).click();

  const dialog = page.getByRole("dialog", { name: "Delete activity?" });
  await expect(dialog).toContainText(activitySummary(removed));
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();

  await expectToast(page, "Activity deleted");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("MANGER > Dej")).toHaveCount(0);
  await expect(page.getByText("MANGER > Ptit-dej")).toBeVisible();
  await expect(page.getByText("1 activity", { exact: true })).toBeVisible();
  expect(await countActivities()).toBe(1);
});
