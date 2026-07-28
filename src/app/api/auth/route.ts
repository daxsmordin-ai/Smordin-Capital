import { NextResponse } from "next/server";
import {
  SITE_ACCESS_COOKIE,
  SITE_ACCESS_MAX_AGE,
  siteAccessToken,
  timingSafeEqual,
} from "@/lib/site-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const password = process.env.SITE_PASSWORD?.trim();

  if (!password) {
    return NextResponse.json(
      { error: "Site password is not configured." },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const submitted = typeof body.password === "string" ? body.password : "";
  const token = await siteAccessToken(password);
  const submittedToken = await siteAccessToken(submitted);

  // Compare fixed-length digests so length differences do not short-circuit.
  if (!submitted || !timingSafeEqual(submittedToken, token)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SITE_ACCESS_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SITE_ACCESS_MAX_AGE,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SITE_ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
