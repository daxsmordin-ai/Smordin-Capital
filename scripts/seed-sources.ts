/* eslint-disable no-console */
import { prisma } from "../src/lib/db";
import { SOURCES } from "../src/lib/sources/feeds";

async function main() {
  for (const config of SOURCES) {
    await prisma.source.upsert({
      where: { name: config.name },
      update: {
        type: config.kind,
        url: config.url ?? null,
        region: config.region ?? null,
        sector: config.sector ?? null,
      },
      create: {
        name: config.name,
        type: config.kind,
        url: config.url ?? null,
        region: config.region ?? null,
        sector: config.sector ?? null,
      },
    });
  }
  const count = await prisma.source.count();
  console.log(`[seed] sources synced: ${count}`);
}

main()
  .catch((err) => {
    console.error("[seed] fatal", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
