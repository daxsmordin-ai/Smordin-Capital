import type { RawArticle, SourceConfig } from "../types";

interface NewsApiArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsApiResponse {
  status: string;
  totalResults?: number;
  articles?: NewsApiArticle[];
  message?: string;
}

export async function fetchNewsApi(source: SourceConfig): Promise<RawArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];
  if (!source.url) return [];

  const params = new URLSearchParams({
    q: source.url,
    sortBy: "publishedAt",
    pageSize: "50",
    language: "en",
  });
  const res = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`, {
    headers: {
      "X-Api-Key": apiKey,
      "User-Agent": "Smordin-Capital/0.1",
    },
  });
  const data = (await res.json()) as NewsApiResponse;
  if (!res.ok || data.status !== "ok") {
    throw new Error(`NewsAPI ${res.status}: ${data.message ?? "unknown error"}`);
  }
  const items = data.articles ?? [];
  return items
    .filter((a) => a.url && a.title)
    .map((a) => ({
      title: a.title,
      summary: a.description ?? a.content ?? undefined,
      url: a.url,
      publishedAt: new Date(a.publishedAt),
      author: a.author ?? undefined,
      imageUrl: a.urlToImage ?? undefined,
      sourceName: a.source?.name ? `NewsAPI – ${a.source.name}` : source.name,
      region: source.region,
      sector: source.sector,
    }));
}
