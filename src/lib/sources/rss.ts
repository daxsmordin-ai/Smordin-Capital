import Parser from "rss-parser";
import type { RawArticle, SourceConfig } from "../types";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "PF-News-Aggregator/0.1 (+https://example.com)",
    Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
  },
});

export async function fetchRss(source: SourceConfig): Promise<RawArticle[]> {
  if (!source.url) return [];
  const feed = await parser.parseURL(source.url);
  const items = feed.items ?? [];
  const out: RawArticle[] = [];
  for (const item of items) {
    const url = item.link ?? item.guid ?? "";
    if (!url) continue;
    const publishedAt = item.isoDate
      ? new Date(item.isoDate)
      : item.pubDate
        ? new Date(item.pubDate)
        : new Date();
    if (Number.isNaN(publishedAt.getTime())) continue;
    out.push({
      title: item.title ?? "(untitled)",
      summary: item.contentSnippet ?? item.content ?? item.summary ?? undefined,
      url,
      publishedAt,
      author: item.creator ?? item.author ?? undefined,
      sourceName: source.name,
      region: source.region,
      sector: source.sector,
    });
  }
  return out;
}
