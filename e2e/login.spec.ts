import { expect, test } from "@playwright/test";

import { ADMIN_EMAIL as adminEmail, ADMIN_PASSWORD as adminPassword, submitLogin } from "./helpers";

// These tests start signed out (the project default is the saved admin session).
test.use({ storageState: { cookies: [], origins: [] } });

test("User logs in successfully", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "ADMIN_EMAIL / ADMIN_PASSWORD are not set");

  await page.goto("/login");
  await submitLogin(page, adminEmail, adminPassword);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Activities Tracking");
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  // Signed-in users never see the login page.
  await page.goto("/login");
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("wrong credentials show a generic error, then the rate limit applies", async ({ page }) => {
  // Unique email per run so the in-memory limiter of a reused server never
  // blocks other tests.
  const email = `nobody-${Date.now()}@example.com`;
  await page.goto("/login");

  for (let attempt = 1; attempt <= 5; attempt++) {
    await submitLogin(page, email, "wrong-password");
    await expect(page.locator("form").getByRole("alert")).toHaveText("Invalid email or password");
  }

  await submitLogin(page, email, "wrong-password");
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Too many attempts, try again later.",
  );
});
