import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

/** Public liveness/readiness probe: checks database connectivity. */
export async function GET(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers });
  } catch (error) {
    console.error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ status: "error" }, { status: 503, headers });
  }
}
