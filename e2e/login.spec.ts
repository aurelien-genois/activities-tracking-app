import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.ADMIN_EMAIL ?? "";
const adminPassword = process.env.ADMIN_PASSWORD ?? "";

async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  // Wait for the Server Action round trip so consecutive attempts never overlap.
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
}

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
