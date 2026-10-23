import { expect, test } from "@playwright/test";

// Anonymous visitor: ignore the saved admin session.
test.use({ storageState: { cookies: [], origins: [] } });

test("anonymous visitor is redirected to the login page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page).toHaveTitle(/Activities Tracking/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("health endpoint is public", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
