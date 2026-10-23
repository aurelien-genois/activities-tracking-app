import { test as setup } from "@playwright/test";

import { ADMIN_STORAGE_STATE, loginAsAdmin } from "./helpers";

// Logs in once; the authenticated specs reuse the saved session (JWT cookie).
setup("authenticate as the admin", async ({ page }) => {
  await loginAsAdmin(page);
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
