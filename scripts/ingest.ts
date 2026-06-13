/* eslint-disable no-console */
import { runIngest } from "../src/lib/ingest";
import { prisma } from "../src/lib/db";

async function main() {
  const filterIdx = process.argv.indexOf("--filter");
  const filterName = filterIdx > -1 ? process.argv[filterIdx + 1] : undefined;
  const maxIdx = process.argv.indexOf("--max");
  const maxPerSource = maxIdx > -1 ? Number(process.argv[maxIdx + 1]) : undefined;

  console.log("[ingest] starting...", { filterName, maxPerSource });
  const summary = await runIngest({ filterName, maxPerSource });
  console.log("[ingest] done", {
    runId: summary.runId,
    sourcesAttempted: summary.sourcesAttempted,
    sourcesSucceeded: summary.sourcesSucceeded,
    articlesFetched: summary.articlesFetched,
    articlesNew: summary.articlesNew,
    durationMs: summary.finishedAt.getTime() - summary.startedAt.getTime(),
  });
  if (summary.errors.length) {
    console.log(`[ingest] ${summary.errors.length} source error(s):`);
    for (const e of summary.errors) console.log("  -", e);
  }
}

main()
  .catch((err) => {
    console.error("[ingest] fatal", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
