import { expect, test } from "@playwright/test";

import {
  activityForm,
  countActivities,
  createActivity,
  deleteAllActivities,
  disconnectDb,
  pastDate,
  recentActivities,
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

const activity = {
  date: pastDate(),
  startTime: "09:00",
  endTime: "10:15",
  category: "TRAVAIL",
  subcategory: "Formation",
  notes: "Playwright course",
};

test("User creates an activity", async ({ page }) => {
  await page.goto("/");
  await expect(recentActivities(page).getByText("No activities yet.")).toBeVisible();

  await createActivity(page, activity);

  // The form is ready for the next activity: chips cleared, start = previous end.
  const form = activityForm(page);
  await expect(
    form.getByRole("group", { name: "Category" }).getByRole("button", { pressed: true }),
  ).toHaveCount(0);
  await expect(form.getByText("Select a category first.")).toBeVisible();
  await expect(form.getByLabel("Start Time")).toHaveValue(activity.endTime);
  await expect(form.getByLabel("Optional note")).toHaveValue("");

  expect(await countActivities()).toBe(1);
});

test("Activity appears in recent activities", async ({ page }) => {
  await page.goto("/");
  await createActivity(page, activity);

  const items = recentActivities(page).getByRole("listitem");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("09:00 - 10:15");
  await expect(items.first()).toContainText("TRAVAIL > Formation");
  await expect(items.first()).toContainText("1h 15m");

  // Persisted: still listed after a full reload.
  await page.reload();
  await expect(recentActivities(page).getByRole("listitem")).toHaveCount(1);
  await expect(recentActivities(page)).toContainText("TRAVAIL > Formation");
});
