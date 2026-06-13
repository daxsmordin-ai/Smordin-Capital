import { createHash } from "node:crypto";
import type { NormalizedArticle, RawArticle } from "./types";
import { classify } from "./classify";

const STRIP_TAGS_RE = /<[^>]+>/g;
const WHITESPACE_RE = /\s+/g;

export function stripHtml(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(STRIP_TAGS_RE, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(WHITESPACE_RE, " ")
    .trim();
}

export function truncate(text: string, max = 480): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 200 ? slice.slice(0, lastSpace) : slice) + "...";
}

/**
 * Normalize a URL for dedupe: drop fragments, strip tracking params, lower-case host.
 */
export function canonicalUrl(input: string): string {
  try {
    const u = new URL(input.trim());
    u.hash = "";
    const drop: string[] = [];
    u.searchParams.forEach((_, key) => {
      if (
        key.startsWith("utm_") ||
        key === "fbclid" ||
        key === "gclid" ||
        key === "mc_cid" ||
        key === "mc_eid" ||
        key === "ref" ||
        key === "ref_src"
      ) {
        drop.push(key);
      }
    });
    drop.forEach((k) => u.searchParams.delete(k));
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "");
    }
    return u.toString();
  } catch {
    return input.trim();
  }
}

export function hashUrl(url: string): string {
  return createHash("sha1").update(canonicalUrl(url)).digest("hex");
}

export function normalize(raw: RawArticle): NormalizedArticle | null {
  const title = stripHtml(raw.title);
  if (!title) return null;
  const url = canonicalUrl(raw.url);
  if (!url || !/^https?:\/\//i.test(url)) return null;

  const summary = truncate(stripHtml(raw.summary ?? ""));
  const tagging = classify({
    title,
    summary,
    sourceName: raw.sourceName,
    region: raw.region,
    sector: raw.sector,
  });

  return {
    ...raw,
    title,
    summary: summary || undefined,
    url,
    urlHash: hashUrl(url),
    region: raw.region ?? tagging.region,
    sector: raw.sector ?? tagging.sector,
    keywords: tagging.keywords,
    relevanceScore: tagging.score,
  };
}
