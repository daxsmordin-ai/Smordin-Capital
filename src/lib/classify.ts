/**
 * Lightweight rules-based classifier. The aggregator's signal/noise problem
 * is well-handled by keyword scoring on title + summary; we keep this in plain
 * TypeScript so it runs without external services.
 */

export interface ClassifyInput {
  title: string;
  summary?: string;
  sourceName?: string;
  region?: string;
  sector?: string;
}

export interface ClassifyResult {
  region?: string;
  sector?: string;
  keywords: string[];
  score: number;
}

interface Rule {
  label: string;
  patterns: RegExp[];
  weight: number;
}

const SECTOR_RULES: Rule[] = [
  {
    label: "Project Finance",
    weight: 5,
    patterns: [
      /\bproject finance\b/i,
      /\bfinancial close\b/i,
      /\bsponsor equity\b/i,
      /\bnon[- ]?recourse\b/i,
      /\blimited recourse\b/i,
      /\bdebt package\b/i,
      /\bsyndicated loan\b/i,
      /\binfrastructure (?:fund|financing|loan|bond)\b/i,
    ],
  },
  {
    label: "Renewables",
    weight: 3,
    patterns: [
      /\bsolar\b/i,
      /\b(?:on|off)shore wind\b/i,
      /\bwind farm\b/i,
      /\bbattery storage\b/i,
      /\benergy storage\b/i,
      /\b(?:green |renewable )?hydrogen\b/i,
      /\bPPA\b/,
      /\brenewables?\b/i,
      /\bphotovoltaic\b/i,
    ],
  },
  {
    label: "Infrastructure",
    weight: 3,
    patterns: [
      /\btoll road\b/i,
      /\bhighway\b/i,
      /\brail(?:way)?\b/i,
      /\bport\b/i,
      /\bairport\b/i,
      /\bdesalination\b/i,
      /\bwater treatment\b/i,
      /\btransmission line\b/i,
      /\bfiber rollout\b/i,
    ],
  },
  {
    label: "Oil & Gas",
    weight: 2,
    patterns: [/\bLNG\b/, /\bnatural gas\b/i, /\bpipeline\b/i, /\brefinery\b/i, /\bupstream\b/i, /\bdownstream\b/i],
  },
  {
    label: "ESG",
    weight: 2,
    patterns: [
      /\bgreen bond\b/i,
      /\bsustainability[- ]linked\b/i,
      /\btaxonomy\b/i,
      /\bnet[- ]?zero\b/i,
      /\bSFDR\b/,
      /\btransition finance\b/i,
    ],
  },
  {
    label: "PPP",
    weight: 4,
    patterns: [/\bpublic[- ]private partnership\b/i, /\bPPP\b/, /\bconcession (?:agreement|award)\b/i, /\bDBFOM?\b/],
  },
  {
    label: "Development Finance",
    weight: 2,
    patterns: [/\bWorld Bank\b/i, /\bIFC\b/, /\bEIB\b/, /\bADB\b/, /\bAfDB\b/, /\bIDB\b/, /\bDFI\b/, /\bblended finance\b/i],
  },
];

const REGION_RULES: Rule[] = [
  {
    label: "Africa",
    weight: 1,
    patterns: [
      /\bAfrica\b/i,
      /\bNigeria\b/i,
      /\bKenya\b/i,
      /\bSouth Africa\b/i,
      /\bEgypt\b/i,
      /\bMorocco\b/i,
      /\bGhana\b/i,
      /\bSenegal\b/i,
      /\bAngola\b/i,
    ],
  },
  {
    label: "Asia",
    weight: 1,
    patterns: [
      /\bAsia\b/i,
      /\bIndia\b/i,
      /\bChina\b/i,
      /\bIndonesia\b/i,
      /\bVietnam\b/i,
      /\bPhilippines\b/i,
      /\bThailand\b/i,
      /\bJapan\b/i,
      /\bKorea\b/i,
      /\bAustralia\b/i,
    ],
  },
  {
    label: "Europe",
    weight: 1,
    patterns: [
      /\bEurope\b/i,
      /\bUK\b/,
      /\bUnited Kingdom\b/i,
      /\bGermany\b/i,
      /\bFrance\b/i,
      /\bSpain\b/i,
      /\bItaly\b/i,
      /\bPoland\b/i,
      /\bNetherlands\b/i,
      /\bIreland\b/i,
    ],
  },
  {
    label: "Latin America",
    weight: 1,
    patterns: [
      /\bLatin America\b/i,
      /\bBrazil\b/i,
      /\bMexico\b/i,
      /\bChile\b/i,
      /\bColombia\b/i,
      /\bPeru\b/i,
      /\bArgentina\b/i,
      /\bUruguay\b/i,
    ],
  },
  {
    label: "Middle East",
    weight: 1,
    patterns: [
      /\bMiddle East\b/i,
      /\bSaudi Arabia\b/i,
      /\bUAE\b/,
      /\bQatar\b/i,
      /\bOman\b/i,
      /\bBahrain\b/i,
      /\bKuwait\b/i,
      /\bIsrael\b/i,
    ],
  },
  {
    label: "North America",
    weight: 1,
    patterns: [
      /\bNorth America\b/i,
      /\bUnited States\b/i,
      /\bU\.S\.\b/,
      /\bUS\b/,
      /\bUSA\b/,
      /\bAmerica\b/i,
      /\bCanada\b/i,
      /\bMexico\b/i,
      /\bTexas\b/i,
      /\bCalifornia\b/i,
      /\bNew York\b/i,
      /\bFlorida\b/i,
      /\bOntario\b/i,
      /\bQuebec\b/i,
      /\bAlberta\b/i,
      /\bBritish Columbia\b/i,
      /\bToronto\b/i,
      /\bVancouver\b/i,
      /\bMontreal\b/i,
    ],
  },
];

const DEAL_BOOSTERS: RegExp[] = [
  /\$\s?\d+(?:[.,]\d+)?\s?(?:bn|billion|m|million)\b/i,
  /\beuro\s?\d+(?:[.,]\d+)?\s?(?:bn|billion|m|million)\b/i,
  /\bsigned\b/i,
  /\bawarded\b/i,
  /\breaches?\s+financial close\b/i,
  /\bclosed\b/i,
  /\bsecures?\b/i,
  /\bissued\b/i,
];

function topMatch(rules: Rule[], haystack: string): { label?: string; score: number; hits: string[] } {
  let best: { label?: string; score: number } = { score: 0 };
  const hits: string[] = [];
  for (const rule of rules) {
    let ruleScore = 0;
    for (const re of rule.patterns) {
      if (re.test(haystack)) {
        ruleScore += rule.weight;
        hits.push(rule.label);
      }
    }
    if (ruleScore > best.score) best = { label: rule.label, score: ruleScore };
  }
  return { ...best, hits };
}

export function classify(input: ClassifyInput): ClassifyResult {
  const haystack = `${input.title}\n${input.summary ?? ""}`;
  const sector = topMatch(SECTOR_RULES, haystack);
  const region = topMatch(REGION_RULES, haystack);

  let score = sector.score + region.score;
  for (const re of DEAL_BOOSTERS) if (re.test(haystack)) score += 1;

  const keywordSet = new Set<string>([...sector.hits, ...region.hits]);
  if (input.sector) keywordSet.add(input.sector);
  if (input.region) keywordSet.add(input.region);

  return {
    sector: input.sector ?? sector.label,
    region: input.region ?? region.label,
    keywords: Array.from(keywordSet),
    score,
  };
}
