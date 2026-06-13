/* eslint-disable no-console */
import { prisma } from "../src/lib/db";
import { classify } from "../src/lib/classify";

async function main() {
  const rows = await prisma.article.findMany({
    where: { region: null },
    select: {
      id: true,
      title: true,
      summary: true,
      sourceName: true,
      sector: true,
      region: true,
      keywordsCsv: true,
      relevanceScore: true,
    },
  });

  let updated = 0;
  for (const a of rows) {
    const c = classify({
      title: a.title,
      summary: a.summary ?? undefined,
      sourceName: a.sourceName,
      sector: a.sector ?? undefined,
      region: a.region ?? undefined,
    });

    const nextRegion = c.region ?? null;
    const existingKeywords = a.keywordsCsv ? a.keywordsCsv.split(",").filter(Boolean) : [];
    const nextKeywords = Array.from(new Set([...existingKeywords, ...c.keywords])).join(",") || null;
    const nextScore = Math.max(a.relevanceScore ?? 0, c.score);

    if (nextRegion !== a.region || nextKeywords !== a.keywordsCsv || nextScore !== a.relevanceScore) {
      await prisma.article.update({
        where: { id: a.id },
        data: {
          region: nextRegion,
          keywordsCsv: nextKeywords,
          relevanceScore: nextScore,
        },
      });
      updated++;
    }
  }

  const byRegion = await prisma.article.groupBy({
    by: ["region"],
    _count: { _all: true },
    orderBy: { _count: { region: "desc" } },
  });

  console.log("backfilled", updated, "articles");
  console.log(byRegion);
}

main()
  .catch((err) => {
    console.error("[backfill] fatal", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
