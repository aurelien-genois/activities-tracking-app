import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import { expect, type Locator, type Page } from "@playwright/test";
import { Pool } from "pg";

import { todayInTz, zonedDateTimeToInstant } from "@/lib/datetime";

// Locally the variables come from `.env`; in CI they are plain environment variables.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Europe/Paris";

/** Session of the seeded admin, written by `auth.setup.ts` and reused by the specs. */
export const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/** Submits the login form and waits for the Server Action round trip. */
export async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  // Waiting for the POST guarantees consecutive attempts never overlap.
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
}

/** Logs in as the seeded admin (ADMIN_EMAIL / ADMIN_PASSWORD) and lands on the home page. */
export async function loginAsAdmin(page: Page): Promise<void> {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to run the e2e tests.");
  }
  await page.goto("/login");
  await submitLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

// Plain `pg` rather than the generated Prisma client: that client is ESM-only
// (`import.meta`) and cannot be loaded by Playwright's CommonJS test runner.
// Table and column names follow src/prisma/schema.prisma.
let pool: Pool | undefined;

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL must be set to run the e2e tests.");
  pool ??= new Pool({ connectionString, max: 2 });
  return pool;
}

/** Removes every activity (the admin user is kept) so each test starts from a known state. */
export async function deleteAllActivities(): Promise<void> {
  await getPool().query('DELETE FROM "Activity"');
}

/** Inserts an activity directly in the database (faster than the UI for edit/delete setups). */
export async function insertActivity(activity: ActivityInput): Promise<void> {
  const startAt = zonedDateTimeToInstant(activity.date, activity.startTime, APP_TIMEZONE);
  const endAt = zonedDateTimeToInstant(activity.date, activity.endTime, APP_TIMEZONE);
  if (!startAt || !endAt)
    throw new Error(`Invalid activity date/time: ${JSON.stringify(activity)}`);
  await getPool().query(
    `INSERT INTO "Activity" ("id", "startAt", "endAt", "category", "subcategory", "notes", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
    [randomUUID(), startAt, endAt, activity.category, activity.subcategory, activity.notes || null],
  );
}

export async function countActivities(): Promise<number> {
  const result = await getPool().query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM "Activity"',
  );
  return Number(result.rows[0].count);
}

export async function disconnectDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * `yyyy-MM-dd` date `daysAgo` days before today in APP_TIMEZONE. Past dates keep
 * the "no future activity" rule out of the way whatever the time of the run.
 */
export function pastDate(daysAgo = 3, now = new Date()): string {
  const today = todayInTz(now, APP_TIMEZONE);
  const [year, month, day] = today.split("-").map(Number);
  const past = new Date(Date.UTC(year, month - 1, day - daysAgo));
  return past.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Activity form
// ---------------------------------------------------------------------------

export type ActivityInput = {
  date: string;
  startTime: string;
  endTime: string;
  category: string;
  subcategory: string;
  notes?: string;
};

/** Selects the chip `name` inside the chip group labelled `group`. */
export async function selectChip(scope: Locator, group: string, name: string): Promise<void> {
  const chip = scope
    .getByRole("group", { name: group, exact: true })
    .getByRole("button", { name, exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
}

/** Fills every field of an activity form (entry form or edit dialog). */
export async function fillActivityFields(form: Locator, activity: ActivityInput): Promise<void> {
  await form.getByLabel("Date").fill(activity.date);
  await form.getByLabel("Start Time").fill(activity.startTime);
  await form.getByLabel("End Time").fill(activity.endTime);
  await selectChip(form, "Category", activity.category);
  await selectChip(form, "Subcategory", activity.subcategory);
  await form.getByLabel("Optional note").fill(activity.notes ?? "");
}

export function activityForm(page: Page): Locator {
  return page.getByRole("form", { name: "New activity" });
}

/** Fills the home page form and clicks Save (does not assert the outcome). */
export async function submitActivity(page: Page, activity: ActivityInput): Promise<void> {
  const form = activityForm(page);
  await fillActivityFields(form, activity);
  await form.getByRole("button", { name: "Save", exact: true }).click();
}

/** Creates an activity through the UI and waits for the success toast. */
export async function createActivity(page: Page, activity: ActivityInput): Promise<void> {
  await submitActivity(page, activity);
  await expectToast(page, "Activity saved");
}

export async function expectToast(page: Page, message: string): Promise<void> {
  // Earlier toasts may still be on screen: any visible match is enough.
  await expect(
    page.getByText(message, { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
}

export function recentActivities(page: Page): Locator {
  return page.getByRole("region", { name: "Recent activities" });
}

/** Accessible summary used by the Edit/Delete buttons, e.g. "09:00 - 10:00, LOISIR > Lecture". */
export function activitySummary(activity: ActivityInput): string {
  return `${activity.startTime} - ${activity.endTime}, ${activity.category} > ${activity.subcategory}`;
}
