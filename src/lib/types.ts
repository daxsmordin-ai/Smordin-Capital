export type SourceKind = "rss" | "gdelt" | "newsapi" | "marketaux";

export interface SourceConfig {
  name: string;
  kind: SourceKind;
  url?: string;
  region?: string;
  sector?: string;
}

export interface RawArticle {
  title: string;
  summary?: string;
  url: string;
  publishedAt: Date;
  author?: string;
  language?: string;
  imageUrl?: string;
  sourceName: string;
  region?: string;
  sector?: string;
}

export interface NormalizedArticle extends RawArticle {
  urlHash: string;
  keywords: string[];
  relevanceScore: number;
}
