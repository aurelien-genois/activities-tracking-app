// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

import { dynamic, GET } from "./route";

describe("GET /api/health", () => {
  afterEach(() => {
    queryRaw.mockReset();
    vi.restoreAllMocks();
  });

  it("is always rendered dynamically", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns 200 when the database answers", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(queryRaw.mock.calls[0]![0]).toEqual(["SELECT 1"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns 503 when the database is unreachable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    queryRaw.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "error" });
    expect(consoleError).toHaveBeenCalledWith("Health check failed: connect ECONNREFUSED");
  });

  it("handles non-Error rejections", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    queryRaw.mockRejectedValue("boom");

    const response = await GET();

    expect(response.status).toBe(503);
    expect(consoleError).toHaveBeenCalledWith("Health check failed: boom");
  });
});
