// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { PrismaClientMock, PrismaPgMock } = vi.hoisted(() => ({
  PrismaClientMock: vi.fn(function (this: Record<string, unknown>, options: unknown) {
    this.options = options;
    this.$queryRaw = vi.fn(function (this: unknown) {
      return this;
    });
    this.user = { findUnique: vi.fn() };
  }),
  PrismaPgMock: vi.fn(function (this: Record<string, unknown>, config: unknown) {
    this.config = config;
  }),
}));

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: PrismaClientMock }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: PrismaPgMock }));

const globalForPrisma = globalThis as unknown as { prisma?: unknown };

async function loadModule() {
  vi.resetModules();
  return import("./prisma");
}

describe("prisma client module", () => {
  beforeEach(() => {
    PrismaClientMock.mockClear();
    PrismaPgMock.mockClear();
    delete globalForPrisma.prisma;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete globalForPrisma.prisma;
  });

  it("does not create a client nor require DATABASE_URL at import time", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await loadModule();
    expect(PrismaClientMock).not.toHaveBeenCalled();
  });

  it("throws a clear error on first use when DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { getPrisma, prisma } = await loadModule();
    expect(() => getPrisma()).toThrow("DATABASE_URL is not set");
    expect(() => prisma.user).toThrow("DATABASE_URL is not set");
  });

  it("creates a single client with the pg driver adapter", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/db");
    const { getPrisma } = await loadModule();

    const first = getPrisma();
    expect(getPrisma()).toBe(first);
    expect(PrismaClientMock).toHaveBeenCalledTimes(1);
    expect(PrismaPgMock).toHaveBeenCalledWith(
      expect.objectContaining({ connectionString: "postgresql://u:p@localhost:5432/db" }),
    );
    expect(PrismaClientMock).toHaveBeenCalledWith({ adapter: PrismaPgMock.mock.instances[0] });
  });

  it("reuses the global instance outside production (hot reload)", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/db");
    vi.stubEnv("NODE_ENV", "development");
    const first = (await loadModule()).getPrisma();
    expect(globalForPrisma.prisma).toBe(first);

    const second = (await loadModule()).getPrisma();
    expect(second).toBe(first);
    expect(PrismaClientMock).toHaveBeenCalledTimes(1);
  });

  it("does not store the instance globally in production", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/db");
    vi.stubEnv("NODE_ENV", "production");
    (await loadModule()).getPrisma();
    expect(globalForPrisma.prisma).toBeUndefined();
  });

  it("proxies properties and binds methods to the real client", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/db");
    const { getPrisma, prisma } = await loadModule();
    const instance = getPrisma();

    expect(prisma.user).toBe(instance.user);
    const queryRaw = prisma.$queryRaw;
    expect((queryRaw as unknown as () => unknown)()).toBe(instance);
  });
});
