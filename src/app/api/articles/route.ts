import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function parseInt0(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const search = sp.get("q")?.trim() || undefined;
  const sector = sp.get("sector") || undefined;
  const region = sp.get("region") || undefined;
  const sourceName = sp.get("source") || undefined;
  const limit = Math.min(parseInt0(sp.get("limit"), 50), 200);
  const offset = parseInt0(sp.get("offset"), 0);
  const sort = sp.get("sort") === "relevance" ? "relevance" : "recent";

  const where: Prisma.ArticleWhereInput = {};
  if (sector && sector !== "all") where.sector = sector;
  if (region && region !== "all") where.region = region;
  if (sourceName && sourceName !== "all") {
    where.sourceName = { contains: sourceName, mode: "insensitive" };
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { keywordsCsv: { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.ArticleOrderByWithRelationInput[] =
    sort === "relevance"
      ? [{ relevanceScore: "desc" }, { publishedAt: "desc" }]
      : [{ publishedAt: "desc" }];

  const [items, total, sectors, regions, sources] = await Promise.all([
    prisma.article.findMany({ where, orderBy, take: limit, skip: offset }),
    prisma.article.count({ where }),
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
  ]);

  return NextResponse.json({
    items: items.map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      url: a.url,
      sourceName: a.sourceName,
      author: a.author,
      publishedAt: a.publishedAt,
      fetchedAt: a.fetchedAt,
      region: a.region,
      sector: a.sector,
      keywords: a.keywordsCsv ? a.keywordsCsv.split(",").filter(Boolean) : [],
      relevanceScore: a.relevanceScore,
      imageUrl: a.imageUrl,
    })),
    total,
    facets: {
      sectors: sectors.map((s) => s.sector).filter((s): s is string => Boolean(s)).sort(),
      regions: regions.map((r) => r.region).filter((r): r is string => Boolean(r)).sort(),
      sources: sources.map((s) => s.sourceName).filter(Boolean),
    },
  });
}
