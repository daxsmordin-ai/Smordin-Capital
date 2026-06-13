import type { Source } from "@prisma/client";
import { prisma } from "./db";
import { SOURCES } from "./sources/feeds";
import { fetchRss } from "./sources/rss";
import { fetchGdelt } from "./sources/gdelt";
import { fetchNewsApi } from "./sources/newsapi";
import { fetchMarketaux } from "./sources/marketaux";
import { normalize } from "./normalize";
import type { RawArticle, SourceConfig, SourceKind } from "./types";

export interface IngestSummary {
  runId: string;
  startedAt: Date;
  finishedAt: Date;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  articlesFetched: number;
  articlesNew: number;
  errors: string[];
}

const KIND_FETCHERS: Record<SourceKind, (s: SourceConfig) => Promise<RawArticle[]>> = {
  rss: fetchRss,
  gdelt: fetchGdelt,
  newsapi: fetchNewsApi,
  marketaux: fetchMarketaux,
};

async function ensureSource(config: SourceConfig): Promise<Source> {
  const existing = await prisma.source.findUnique({ where: { name: config.name } });
  if (existing) {
    if (
      existing.type !== config.kind ||
      existing.url !== (config.url ?? null) ||
      existing.region !== (config.region ?? null) ||
      existing.sector !== (config.sector ?? null)
    ) {
      return prisma.source.update({
        where: { id: existing.id },
        data: {
          type: config.kind,
          url: config.url ?? null,
          region: config.region ?? null,
          sector: config.sector ?? null,
        },
      });
    }
    return existing;
  }
  return prisma.source.create({
    data: {
      name: config.name,
      type: config.kind,
      url: config.url ?? null,
      region: config.region ?? null,
      sector: config.sector ?? null,
    },
  });
}

function isApiSourceWithoutKey(config: SourceConfig): boolean {
  if (config.kind === "newsapi" && !process.env.NEWS_API_KEY) return true;
  if (config.kind === "marketaux" && !process.env.MARKETAUX_API_KEY) return true;
  return false;
}

export interface RunOptions {
  /** Only run sources whose name contains this string (case-insensitive). */
  filterName?: string;
  /** Cap on persisted articles per source. */
  maxPerSource?: number;
}

export async function runIngest(options: RunOptions = {}): Promise<IngestSummary> {
  const startedAt = new Date();
  const run = await prisma.fetchRun.create({ data: { startedAt } });
  const errors: string[] = [];
  let sourcesAttempted = 0;
  let sourcesSucceeded = 0;
  let articlesFetched = 0;
  let articlesNew = 0;
  const maxPerSource =
    options.maxPerSource ?? Number(process.env.INGEST_MAX_PER_SOURCE ?? 50);

  const queue = SOURCES.filter((s) =>
    options.filterName ? s.name.toLowerCase().includes(options.filterName.toLowerCase()) : true,
  );

  for (const config of queue) {
    if (isApiSourceWithoutKey(config)) continue;
    sourcesAttempted++;
    let dbSource: Source;
    try {
      dbSource = await ensureSource(config);
    } catch (err) {
      errors.push(`[${config.name}] ensureSource failed: ${(err as Error).message}`);
      continue;
    }
    try {
      const fetcher = KIND_FETCHERS[config.kind];
      const raw = await fetcher(config);
      articlesFetched += raw.length;

      const normalized = raw
        .map((r) => normalize(r))
        .filter((n): n is NonNullable<ReturnType<typeof normalize>> => Boolean(n))
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, maxPerSource);

      for (const item of normalized) {
        try {
          const existing = await prisma.article.findUnique({
            where: { urlHash: item.urlHash },
            select: { id: true },
          });
          const data = {
            title: item.title,
            summary: item.summary ?? null,
            author: item.author ?? null,
            publishedAt: item.publishedAt,
            region: item.region ?? null,
            sector: item.sector ?? null,
            keywordsCsv: item.keywords.join(","),
            relevanceScore: item.relevanceScore,
            language: item.language ?? null,
            imageUrl: item.imageUrl ?? null,
            sourceName: item.sourceName,
            sourceId: dbSource.id,
          };
          if (existing) {
            await prisma.article.update({ where: { id: existing.id }, data });
          } else {
            await prisma.article.create({
              data: { ...data, url: item.url, urlHash: item.urlHash },
            });
            articlesNew++;
          }
        } catch (err) {
          errors.push(`[${config.name}] persist failed: ${(err as Error).message}`);
        }
      }

      await prisma.source.update({
        where: { id: dbSource.id },
        data: { lastFetchedAt: new Date(), lastError: null },
      });
      sourcesSucceeded++;
    } catch (err) {
      const message = (err as Error).message;
      errors.push(`[${config.name}] ${message}`);
      try {
        await prisma.source.update({
          where: { id: dbSource.id },
          data: { lastFetchedAt: new Date(), lastError: message.slice(0, 500) },
        });
      } catch {
        // ignore secondary failures
      }
    }
  }

  const finishedAt = new Date();
  await prisma.fetchRun.update({
    where: { id: run.id },
    data: {
      finishedAt,
      sourcesAttempted,
      sourcesSucceeded,
      articlesFetched,
      articlesNew,
      errors: errors.length ? errors.join("\n") : null,
    },
  });

  return {
    runId: run.id,
    startedAt,
    finishedAt,
    sourcesAttempted,
    sourcesSucceeded,
    articlesFetched,
    articlesNew,
    errors,
  };
}
