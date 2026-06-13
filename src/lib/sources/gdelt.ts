import type { RawArticle, SourceConfig } from "../types";

interface GdeltArticle {
  url: string;
  url_mobile?: string;
  title: string;
  seendate: string; // YYYYMMDDTHHMMSSZ
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

const GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";

function parseSeenDate(seen: string): Date {
  // Format: 20240517T123045Z
  const m = seen.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return new Date();
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

export async function fetchGdelt(source: SourceConfig): Promise<RawArticle[]> {
  if (!source.url) return [];
  const params = new URLSearchParams({
    query: source.url,
    mode: "ArtList",
    format: "json",
    maxrecords: "75",
    sort: "DateDesc",
    timespan: "3d",
  });
  const res = await fetch(`${GDELT_ENDPOINT}?${params.toString()}`, {
    headers: {
      "User-Agent": "Smordin-Capital/0.1",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`GDELT ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  // GDELT can return non-JSON on errors
  let data: GdeltResponse;
  try {
    data = JSON.parse(text) as GdeltResponse;
  } catch {
    throw new Error(`GDELT returned non-JSON payload: ${text.slice(0, 120)}`);
  }
  const articles = data.articles ?? [];
  return articles.map((a) => ({
    title: a.title,
    url: a.url,
    publishedAt: parseSeenDate(a.seendate),
    language: a.language,
    imageUrl: a.socialimage,
    sourceName: a.domain ? `${source.name} (${a.domain})` : source.name,
    region: source.region,
    sector: source.sector,
  }));
}
