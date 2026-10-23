import { z } from "zod";

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  AUTH_TRUST_HOST: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  APP_TIMEZONE: z
    .string()
    .default("Europe/Paris")
    .refine(isValidTimeZone, "must be a valid IANA time zone"),
});

export type Env = z.infer<typeof envSchema>;

type EnvSource = Record<string, string | undefined>;

export function parseEnv(source: EnvSource): Env {
  const normalized = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === "" ? undefined : value]),
  );
  const result = envSchema.safeParse(normalized);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment variables: ${details}`);
  }
  return result.data;
}

let cachedEnv: Env | undefined;

/**
 * Validates `process.env` on first access only (never at import time), so
 * `next build` does not require runtime secrets.
 */
export function getEnv(): Env {
  cachedEnv ??= parseEnv(process.env);
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = undefined;
}
