import { getPrisma } from "../lib/prisma";
import { seedAdmin } from "../lib/seed-admin";

async function main(): Promise<void> {
  const prisma = getPrisma();
  try {
    const admin = await seedAdmin(prisma, process.env);
    console.log(`Admin user ready: ${admin.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
