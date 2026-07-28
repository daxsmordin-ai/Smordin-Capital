import { NextResponse, type NextRequest } from "next/server";
import {
  SITE_ACCESS_COOKIE,
  siteAccessToken,
  timingSafeEqual,
} from "@/lib/site-auth";

export async function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD?.trim();

  // Protection is off until SITE_PASSWORD is configured.
  if (!password) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Public paths needed to unlock the site, plus cron ingest (has its own token).
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/ingest")
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SITE_ACCESS_COOKIE)?.value;
  const expected = await siteAccessToken(password);

  if (cookie && timingSafeEqual(cookie, expected)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  if (pathname !== "/") {
    loginUrl.searchParams.set("from", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Protect everything except Next internals and common static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
