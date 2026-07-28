export const SITE_ACCESS_COOKIE = "site_access";

/** Cookie lifetime: 30 days */
export const SITE_ACCESS_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Stable token derived from SITE_PASSWORD. Stored in an httpOnly cookie
 * after a successful login; middleware compares against the same value.
 */
export async function siteAccessToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`smordin-capital-site:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
