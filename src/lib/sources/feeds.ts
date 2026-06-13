import type { SourceConfig } from "../types";

/**
 * Curated, public-by-default sources for project finance, infrastructure,
 * energy transition, and development finance coverage. RSS first, with GDELT
 * and optional API providers layered on top during ingestion.
 *
 * Feeds occasionally move; ingestion logs errors per source and the dashboard
 * surfaces "last error" so the list can be pruned over time.
 */
export const SOURCES: SourceConfig[] = [
  // Project finance and infrastructure trade press
  {
    name: "Reuters Sustainable Business",
    kind: "rss",
    url: "https://www.reutersagency.com/feed/?best-topics=sustainable-business&post_type=best",
    sector: "ESG",
  },
  {
    name: "World Bank News",
    kind: "rss",
    url: "https://www.worldbank.org/en/news/all.rss",
    sector: "Development Finance",
  },
  {
    name: "IFC Press Releases",
    kind: "rss",
    url: "https://pressroom.ifc.org/all/pages/PressReleaseAll.aspx?Type=RSS",
    sector: "Development Finance",
  },
  {
    name: "EIB News",
    kind: "rss",
    url: "https://www.eib.org/en/feed.rss",
    region: "Europe",
    sector: "Development Finance",
  },
  {
    name: "ADB News",
    kind: "rss",
    url: "https://www.adb.org/news/rss",
    region: "Asia",
    sector: "Development Finance",
  },
  {
    name: "AfDB News",
    kind: "rss",
    url: "https://www.afdb.org/en/rss.xml",
    region: "Africa",
    sector: "Development Finance",
  },
  {
    name: "IDB News",
    kind: "rss",
    url: "https://www.iadb.org/en/rss/news",
    region: "Latin America",
    sector: "Development Finance",
  },
  {
    name: "BNamericas Infrastructure",
    kind: "rss",
    url: "https://www.bnamericas.com/en/rss/sector/infrastructure",
    region: "Latin America",
    sector: "Infrastructure",
  },

  // Energy transition and power
  {
    name: "PV Magazine",
    kind: "rss",
    url: "https://www.pv-magazine.com/feed/",
    sector: "Renewables",
  },
  {
    name: "reNews",
    kind: "rss",
    url: "https://renews.biz/feed/",
    sector: "Renewables",
  },
  {
    name: "Recharge News",
    kind: "rss",
    url: "https://www.rechargenews.com/rss",
    sector: "Renewables",
  },
  {
    name: "Hydrogen Insight",
    kind: "rss",
    url: "https://www.hydrogeninsight.com/rss",
    sector: "Hydrogen",
  },
  {
    name: "Wind Power Monthly",
    kind: "rss",
    url: "https://www.windpowermonthly.com/rss",
    sector: "Renewables",
  },
  {
    name: "Energy Voice",
    kind: "rss",
    url: "https://www.energyvoice.com/feed/",
    sector: "Energy",
  },

  // Infrastructure / transport / PPP
  {
    name: "Global Construction Review",
    kind: "rss",
    url: "https://www.globalconstructionreview.com/feed/",
    sector: "Construction",
  },
  {
    name: "Engineering News-Record",
    kind: "rss",
    url: "https://www.enr.com/rss/articles/3-current-headlines",
    sector: "Construction",
  },
  {
    name: "Global Trade Review",
    kind: "rss",
    url: "https://www.gtreview.com/feed/",
    sector: "Trade Finance",
  },

  // Broad finance / markets
  {
    name: "Reuters Business",
    kind: "rss",
    url: "https://feeds.reuters.com/reuters/businessNews",
    sector: "Finance",
  },
  {
    name: "FT Companies",
    kind: "rss",
    url: "https://www.ft.com/companies?format=rss",
    sector: "Finance",
  },

  // Aggregators that work without API keys
  {
    name: "GDELT Project Finance",
    kind: "gdelt",
    url:
      'theme:ECON_BANKRUPTCY OR theme:ECON_INTEREST_RATE OR ' +
      '("project finance" OR "infrastructure financing" OR "PPP" OR ' +
      '"public-private partnership" OR "green bond" OR "sustainability-linked loan")',
    sector: "Project Finance",
  },
  {
    name: "GDELT Renewables Deals",
    kind: "gdelt",
    url:
      '("solar farm" OR "wind farm" OR "offshore wind" OR "battery storage" OR ' +
      '"green hydrogen") AND ("financing" OR "financial close" OR "tender" OR "PPA")',
    sector: "Renewables",
  },

  // Optional API-based sources (skipped if no key configured)
  {
    name: "NewsAPI Project Finance",
    kind: "newsapi",
    url:
      '"project finance" OR "infrastructure financing" OR "financial close" OR ' +
      '"green bond" OR "sustainability-linked loan" OR "public-private partnership"',
    sector: "Project Finance",
  },
  {
    name: "Marketaux Energy & Infra",
    kind: "marketaux",
    url: "energy,industrials,utilities",
    sector: "Energy",
  },
];
