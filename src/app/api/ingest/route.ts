import { NextRequest, NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) return true; // unauthenticated mode in local dev
  const header = req.headers.get("authorization") ?? "";
  const tokenFromHeader = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : null;
  const tokenFromQuery = req.nextUrl.searchParams.get("token");
  return tokenFromHeader === expected || tokenFromQuery === expected;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const filterName = req.nextUrl.searchParams.get("filter") ?? undefined;
  const summary = await runIngest({ filterName });
  return NextResponse.json(summary);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
