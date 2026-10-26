---
name: quality-checks
description: "Run this project's code-quality checks: ESLint, Prettier formatting validation, and tests. Use before submitting changes or when asked to lint, format-check, or test the repository."
argument-hint: "Optional: specify a test file or ask to include end-to-end tests"
---

# Project Quality Checks

Run the repository's quality checks and report each result clearly.

## Procedure

1. Run from the repository root. Check `package.json` if the scripts may have changed.
2. Run all three checks, even if one fails, so the report captures every result:
   - `npm run lint` — ESLint
   - `npm run format:check` — Prettier validation; this checks formatting without changing files
   - `npm test` — Vitest tests with coverage
3. If the user specifies a test file, use the repository's supported Vitest filtering syntax while preserving the test command's coverage behavior.
4. Run `npm run test:e2e` only when the user requests end-to-end tests or the change specifically affects a browser workflow. Check the Playwright configuration and required services before running it.
5. Summarize each check as passed or failed. Include relevant failure output and do not claim the checks passed if any command failed or could not run.
