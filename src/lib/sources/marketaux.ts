import type { RawArticle, SourceConfig } from "../types";

interface MarketauxArticle {
  uuid: string;
  title: string;
  description: string | null;
  snippet: string | null;
  url: string;
  image_url: string | null;
  language: string | null;
  published_at: string;
  source: string | null;
}

interface MarketauxResponse {
  data?: MarketauxArticle[];
  error?: { code?: string; message?: string };
}

export async function fetchMarketaux(source: SourceConfig): Promise<RawArticle[]> {
  const apiKey = process.env.MARKETAUX_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    api_token: apiKey,
    industries: source.url ?? "energy,industrials,utilities",
    language: "en",
    limit: "50",
    filter_entities: "true",
  });
  const res = await fetch(`https://api.marketaux.com/v1/news/all?${params.toString()}`, {
    headers: { "User-Agent": "PF-News-Aggregator/0.1" },
  });
  const data = (await res.json()) as MarketauxResponse;
  if (!res.ok) {
    throw new Error(`Marketaux ${res.status}: ${data.error?.message ?? "unknown error"}`);
  }
  const items = data.data ?? [];
  return items.map((a) => ({
    title: a.title,
    summary: a.description ?? a.snippet ?? undefined,
    url: a.url,
    publishedAt: new Date(a.published_at),
    language: a.language ?? undefined,
    imageUrl: a.image_url ?? undefined,
    sourceName: a.source ? `Marketaux – ${a.source}` : source.name,
    region: source.region,
    sector: source.sector,
  }));
}
