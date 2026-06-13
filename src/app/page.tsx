import Dashboard from "@/components/Dashboard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface FilterFacets {
  sectors: string[];
  regions: string[];
  sources: string[];
}

async function loadInitialData() {
  const [items, total, sectors, regions, sources, lastRun, sourceStats] = await Promise.all([
    prisma.article.findMany({
      orderBy: [{ publishedAt: "desc" }],
      take: 50,
    }),
    prisma.article.count(),
    prisma.article.findMany({
      where: { sector: { not: null } },
      distinct: ["sector"],
      select: { sector: true },
    }),
    prisma.article.findMany({
      where: { region: { not: null } },
      distinct: ["region"],
      select: { region: true },
    }),
    prisma.article.findMany({
      distinct: ["sourceName"],
      select: { sourceName: true },
      orderBy: { sourceName: "asc" },
    }),
    prisma.fetchRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
  ]);

  const facets: FilterFacets = {
    sectors: sectors.map((s) => s.sector).filter((s): s is string => Boolean(s)).sort(),
    regions: regions.map((r) => r.region).filter((r): r is string => Boolean(r)).sort(),
    sources: sources.map((s) => s.sourceName).filter(Boolean),
  };

  return {
    items: items.map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      url: a.url,
      sourceName: a.sourceName,
      author: a.author,
      publishedAt: a.publishedAt.toISOString(),
      fetchedAt: a.fetchedAt.toISOString(),
      region: a.region,
      sector: a.sector,
      keywords: a.keywordsCsv ? a.keywordsCsv.split(",").filter(Boolean) : [],
      relevanceScore: a.relevanceScore,
      imageUrl: a.imageUrl,
    })),
    total,
    facets,
    lastRun: lastRun
      ? {
          startedAt: lastRun.startedAt.toISOString(),
          finishedAt: lastRun.finishedAt?.toISOString() ?? null,
          articlesFetched: lastRun.articlesFetched,
          articlesNew: lastRun.articlesNew,
          sourcesAttempted: lastRun.sourcesAttempted,
          sourcesSucceeded: lastRun.sourcesSucceeded,
          errors: lastRun.errors,
        }
      : null,
    sourceStats: sourceStats.map((s) => ({
      name: s.name,
      type: s.type,
      enabled: s.enabled,
      lastFetchedAt: s.lastFetchedAt?.toISOString() ?? null,
      lastError: s.lastError,
    })),
  };
}

export default async function Home() {
  const initial = await loadInitialData();
  return <Dashboard initial={initial} />;
}
