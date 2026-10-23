import { expect, test } from "@playwright/test";

import {
  activityForm,
  countActivities,
  createActivity,
  deleteAllActivities,
  disconnectDb,
  expectToast,
  pastDate,
  recentActivities,
  submitActivity,
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

test("User creates an overlapping activity; validation error is displayed", async ({ page }) => {
  const date = pastDate();
  await page.goto("/");
  await createActivity(page, {
    date,
    startTime: "09:00",
    endTime: "10:00",
    category: "LOISIR",
    subcategory: "Lecture",
  });

  await submitActivity(page, {
    date,
    startTime: "09:30",
    endTime: "10:30",
    category: "REPOS",
    subcategory: "Trainer",
  });

  await expect(activityForm(page).getByRole("alert")).toHaveText(
    "This activity overlaps an existing activity (09:00 - 10:00, LOISIR > Lecture).",
  );
  await expect(recentActivities(page).getByRole("listitem")).toHaveCount(1);
  expect(await countActivities()).toBe(1);

  // Back-to-back activities are allowed: 10:00 - 11:00 is accepted.
  const form = activityForm(page);
  await form.getByLabel("Start Time").fill("10:00");
  await form.getByLabel("End Time").fill("11:00");
  await expect(form.getByRole("alert")).toBeHidden();
  await form.getByRole("button", { name: "Save", exact: true }).click();

  await expect(recentActivities(page).getByRole("listitem")).toHaveCount(2);
  await expectToast(page, "Activity saved");
  await expect(recentActivities(page).getByRole("listitem").first()).toContainText("10:00 - 11:00");
  expect(await countActivities()).toBe(2);
});
