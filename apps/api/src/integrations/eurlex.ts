import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { Obligation } from "../types";

const SPARQL_ENDPOINT = "https://publications.europa.eu/webapi/rdf/sparql";
const CELLAR_BASE = "https://publications.europa.eu/resource/celex";

// ─── Local types ──────────────────────────────────────────────────────────────

export type CelexMetadata = {
  celexNumber: string;
  title: string | null;
  inForce: boolean | null;
  dateOfDocument: string | null;
  sourceUrl: string;
  retrievedAt: string;
  fromCache: boolean;
};

export type ArticleText = {
  celexNumber: string;
  articleNumber: string;
  /** null when the article heading was not found in the document */
  articleText: string | null;
  /** Character count of the full HTML-stripped document text */
  fullDocumentLength: number;
  sourceUrl: string;
  retrievedAt: string;
  fromCache: boolean;
};

export type EULaw = {
  celexNumber: string;
  metadata: CelexMetadata;
  articles: Map<string, ArticleText>;
  fetchedAt: string;
};

// ─── In-memory caches ─────────────────────────────────────────────────────────

const METADATA_TTL = 3_600_000; // 1 hour
const ARTICLE_TTL = 7_200_000; // 2 hours

const metadataCache = new Map<string, { data: CelexMetadata; cachedAt: number }>();
const articleCache = new Map<string, { data: ArticleText; cachedAt: number }>();

/** Returns cached data if present and within TTL, otherwise null. */
function getCached<T>(
  cache: Map<string, { data: T; cachedAt: number }>,
  key: string,
  ttl: number,
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Collapse whitespace in extracted text. */
function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Searches `fullText` for a given article number using several heading patterns
 * and returns up to 3000 characters from the match to the next article boundary.
 * Returns null if the article is not found.
 */
function extractArticleText(
  fullText: string,
  articleNumber: string,
): string | null {
  const patterns = [
    `Article ${articleNumber}`,
    `ARTICLE ${articleNumber}`,
    `Art. ${articleNumber}`,
  ];

  let startIdx = -1;
  for (const pattern of patterns) {
    const idx = fullText.indexOf(pattern);
    if (idx !== -1) {
      startIdx = idx;
      break;
    }
  }
  if (startIdx === -1) return null;

  const snippet = fullText.slice(startIdx);

  // Find next article heading boundary (skip first 20 chars to avoid re-matching self)
  const nextBoundary = snippet.slice(20).match(/\b(?:Article|ARTICLE|Art\.)\s+\d+/);
  const endIdx =
    nextBoundary?.index !== undefined
      ? nextBoundary.index + 20
      : snippet.length;

  return snippet.slice(0, Math.min(endIdx, 3000)).trim();
}

// ─── Runtime functions ────────────────────────────────────────────────────────

/**
 * Queries EUR-Lex CELLAR SPARQL endpoint to verify a CELEX number and retrieve
 * basic metadata. Results are cached for 1 hour.
 *
 * Called live by Agent 2 during analysis to prove citations are real.
 * On any error, returns a degraded object with null fields rather than throwing.
 */
export async function verifyCelex(celexNumber: string): Promise<CelexMetadata> {
  const fallback: CelexMetadata = {
    celexNumber,
    title: null,
    inForce: null,
    dateOfDocument: null,
    sourceUrl: `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celexNumber}`,
    retrievedAt: new Date().toISOString(),
    fromCache: false,
  };

  const cached = getCached(metadataCache, celexNumber, METADATA_TTL);
  if (cached) return { ...cached, fromCache: true };

  const sparqlQuery = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT ?title ?date ?force WHERE {
  ?work cdm:resource_legal_id_celex "${celexNumber}" .
  OPTIONAL { ?work cdm:title ?title . FILTER(lang(?title) = "en") }
  OPTIONAL { ?work cdm:work_date_document ?date }
  OPTIONAL { ?work cdm:resource_legal_in-force ?force }
} LIMIT 1`;

  try {
    const body =
      `query=${encodeURIComponent(sparqlQuery)}` +
      `&format=application%2Fsparql-results%2Bjson`;

    const res = await fetch(SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body,
    });

    if (!res.ok) {
      console.error(
        `[EUR-Lex] SPARQL ${res.status} for ${celexNumber}`,
      );
      return fallback;
    }

    const data = (await res.json()) as {
      results: {
        bindings: Array<{
          title?: { value: string };
          date?: { value: string };
          force?: { value: string };
        }>;
      };
    };

    const binding = data?.results?.bindings?.[0] ?? {};
    const result: CelexMetadata = {
      celexNumber,
      title: binding.title?.value ?? null,
      inForce:
        binding.force !== undefined ? binding.force.value === "true" : null,
      dateOfDocument: binding.date?.value ?? null,
      sourceUrl: `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celexNumber}`,
      retrievedAt: new Date().toISOString(),
      fromCache: false,
    };

    metadataCache.set(celexNumber, { data: result, cachedAt: Date.now() });
    return result;
  } catch (err) {
    console.error(`[EUR-Lex] verifyCelex(${celexNumber}) error:`, err);
    return fallback;
  }
}

/**
 * Fetches the full HTML text of an EU legal act from CELLAR and extracts the
 * text of a specific article by number. Results are cached for 2 hours.
 *
 * Called live by Agent 2 to retrieve authoritative article text.
 * On any error, returns a result with articleText: null rather than throwing.
 */
export async function fetchArticleText(
  celexNumber: string,
  articleNumber: string,
): Promise<ArticleText> {
  const cacheKey = `${celexNumber}:${articleNumber}`;
  const fallback: ArticleText = {
    celexNumber,
    articleNumber,
    articleText: null,
    fullDocumentLength: 0,
    sourceUrl: `${CELLAR_BASE}/${celexNumber}`,
    retrievedAt: new Date().toISOString(),
    fromCache: false,
  };

  const cached = getCached(articleCache, cacheKey, ARTICLE_TTL);
  if (cached) return { ...cached, fromCache: true };

  try {
    const url = `${CELLAR_BASE}/${celexNumber}`;
    const res = await fetch(url, {
      headers: {
        Accept: "text/html",
        "Accept-Language": "eng",
      },
    });

    if (!res.ok) {
      console.error(`[EUR-Lex] fetchArticleText HTTP ${res.status} for ${celexNumber}`);
      articleCache.set(cacheKey, { data: fallback, cachedAt: Date.now() });
      return fallback;
    }

    const html = await res.text();

    // Strip navigation chrome and scripts with cheerio
    const $ = cheerio.load(html);
    $("script, style, nav, header, footer, aside, .navigation").remove();
    const rawText = $("body").length > 0 ? $("body").text() : $.root().text();
    const fullText = collapseWhitespace(rawText);

    const articleText = extractArticleText(fullText, articleNumber);

    const result: ArticleText = {
      celexNumber,
      articleNumber,
      articleText,
      fullDocumentLength: fullText.length,
      sourceUrl: url,
      retrievedAt: new Date().toISOString(),
      fromCache: false,
    };

    articleCache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  } catch (err) {
    console.error(
      `[EUR-Lex] fetchArticleText(${celexNumber}, ${articleNumber}) error:`,
      err,
    );
    articleCache.set(cacheKey, { data: fallback, cachedAt: Date.now() });
    return fallback;
  }
}

// ─── Pre-fetch function ───────────────────────────────────────────────────────

/**
 * Pre-fetches and caches EU law metadata and article texts.
 * Called once by the build script before the hackathon starts.
 * Populates the in-memory cache so Agent 2 runtime calls are instant.
 */
export async function prefetchEULaws(
  laws: Array<{ celex: string; articleNumbers: string[] }>,
): Promise<Map<string, EULaw>> {
  const euLawMap = new Map<string, EULaw>();

  for (const { celex, articleNumbers } of laws) {
    console.log(`[EU] Fetching ${celex}...`);

    const metadata = await verifyCelex(celex);
    console.log(
      `[EU] ${celex}: metadata ok, fetching ${articleNumbers.length} articles...`,
    );

    const articleResults = await Promise.allSettled(
      articleNumbers.map((n) => fetchArticleText(celex, n)),
    );

    const articles = new Map<string, ArticleText>();
    articleResults.forEach((result, i) => {
      const n = articleNumbers[i]!;
      if (result.status === "fulfilled") {
        console.log(`[EU] ${celex}: article ${n} ok`);
        articles.set(n, result.value);
      } else {
        console.log(`[EU] ${celex}: article ${n} failed`);
      }
    });

    euLawMap.set(celex, {
      celexNumber: celex,
      metadata,
      articles,
      fetchedAt: new Date().toISOString(),
    });
  }

  return euLawMap;
}

// ─── Upcoming / proposed EU legislation ───────────────────────────────────────

/**
 * Curated list of EU legal instruments that are either (a) adopted but not yet
 * in force across all member states, or (b) Commission proposals with realistic
 * odds of adoption. Each entry references a CELEX number that we verify live
 * via the existing verifyCelex() call so citations remain authoritative.
 *
 * This list is intentionally small and partner-curated rather than scraped —
 * proposed-law SPARQL queries over EUR-Lex CELLAR are noisy and would introduce
 * a lot of irrelevant material. Maintained in-code so partners can trivially
 * add/remove items per sector practice group.
 */
export interface UpcomingEULaw {
  celex: string;
  title: string;
  category: "tax" | "employment" | "data" | "licensing" | "sanctions" | "corporate";
  /** "proposed" = Commission proposal awaiting adoption. "upcoming" = adopted, effective in future. */
  status: "proposed" | "upcoming";
  /** Expected or scheduled entry into application (ISO date). */
  effectiveDate: string;
  summary: string;
  /** Broad industries most affected. Empty ≈ applies across the board. */
  industryRelevance: string[];
  /** If non-empty, only surface when the twin's target country set intersects this list. */
  memberStateScope?: string[];
}

export const UPCOMING_EU_LAWS: UpcomingEULaw[] = [
  {
    celex: "32024R1689",
    title: "AI Act — General-Purpose AI Model Obligations",
    category: "licensing",
    status: "upcoming",
    effectiveDate: "2026-08-02",
    summary:
      "General-purpose AI model provider obligations (transparency, copyright, model evaluation) apply from Aug 2026. High-risk AI system duties phase in on the same schedule. Impacts HR analytics, scoring, and automated decision-making tools.",
    industryRelevance: ["HR SaaS", "fintech", "biomedical", "manufacturing"],
  },
  {
    celex: "32023L0970",
    title: "Pay Transparency Directive",
    category: "employment",
    status: "upcoming",
    effectiveDate: "2026-06-07",
    summary:
      "Member states must transpose pay transparency duties by 7 June 2026. Employers with 100+ workers must publish gender pay-gap reporting; applicants gain a right to pay-range disclosure pre-interview. Impacts HR/payroll architecture.",
    industryRelevance: ["HR SaaS"],
  },
  {
    celex: "32022L2555",
    title: "NIS2 Directive — Cyber Resilience for Essential Entities",
    category: "data",
    status: "upcoming",
    effectiveDate: "2025-10-17",
    summary:
      "Expands cybersecurity reporting and governance duties to medium and large entities in digital services, including cloud and HR platforms. National transposition ongoing; DE and FI have already enacted local statutes.",
    industryRelevance: ["HR SaaS", "fintech", "manufacturing"],
  },
  {
    celex: "32022R2065",
    title: "Digital Services Act — Scaled Online Platform Duties",
    category: "data",
    status: "upcoming",
    effectiveDate: "2024-02-17",
    summary:
      "DSA scaled-platform obligations (content-moderation transparency, risk assessment) already apply. Enforcement intensifies through 2026 with national Digital Services Coordinators. Sector-specific AI/HR tooling caught where user-facing.",
    industryRelevance: ["HR SaaS", "fintech"],
  },
  {
    celex: "32022R2554",
    title: "DORA — Digital Operational Resilience Act",
    category: "data",
    status: "upcoming",
    effectiveDate: "2025-01-17",
    summary:
      "Financial entities must meet ICT risk-management, incident reporting, and third-party-provider oversight obligations. Critical ICT providers (incl. SaaS serving financial institutions) fall in scope.",
    industryRelevance: ["fintech", "HR SaaS"],
  },
  {
    celex: "52024PC0060",
    title: "EU FASTER Directive — Withholding Tax Relief",
    category: "tax",
    status: "proposed",
    effectiveDate: "2027-01-01",
    summary:
      "Proposal to streamline withholding-tax relief for cross-border investors. Adds new digital tax residence certificate and standardised relief-at-source procedure. Relevant where cross-border intra-group payments exist.",
    industryRelevance: [],
  },
];

/**
 * Returns upcoming/proposed EU laws relevant to a twin (by industry + target
 * member states). Each is converted to an Obligation so it flows through the
 * same downstream pipeline (conflicts, memo, risk register) with the status
 * flag surfaced in the UI.
 */
export async function loadUpcomingObligations(
  targetCountries: string[],
  industry: string,
): Promise<Obligation[]> {
  const inScopeMemberStates = new Set(targetCountries);
  if (inScopeMemberStates.size === 0) return [];

  const industryLc = industry.toLowerCase();
  const matches = UPCOMING_EU_LAWS.filter((law) => {
    if (law.memberStateScope && !law.memberStateScope.some((m) => inScopeMemberStates.has(m))) {
      return false;
    }
    if (law.industryRelevance.length === 0) return true;
    return law.industryRelevance.some((ind) => industryLc.includes(ind.toLowerCase()));
  });

  // Verify each law's CELEX against EUR-Lex so the source is marked isLive when possible.
  const obligations = await Promise.all(
    matches.map(async (law) => {
      const metadata = await verifyCelex(law.celex).catch(() => null);
      const isLive = !!metadata && metadata.title !== null;
      const obligation: Obligation = {
        id: `EU-upcoming-${law.celex}`,
        jurisdiction: "EU",
        category: law.category,
        title: law.title,
        description: law.summary,
        trigger: `Becomes applicable on ${law.effectiveDate}`,
        threshold: null,
        severity: law.status === "proposed" ? "medium" : "high",
        source: {
          citation: `EUR-Lex ${law.celex}`,
          url: `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${law.celex}`,
          retrievedAt: new Date().toISOString(),
          isLive,
        },
        confidence: law.status === "proposed" ? 0.7 : 0.95,
        requiresLocalCounsel: law.status !== "proposed",
        legislationStatus: law.status,
        effectiveDate: law.effectiveDate,
      };
      return obligation;
    }),
  );

  return obligations;
}

// ─── Backward-compatible exports for Agent 2 ─────────────────────────────────

/** CELEX numbers for key EU regulations used by Agent 2 for citation enrichment. */
export const CELEX_MAP: Record<string, string> = {
  gdpr: "32016R0679",
  "ai-act": "32024R1689",
  csrd: "32022L2464",
  dac7: "32021R0821",
};

/**
 * Enriches an Obligation's source metadata by verifying its CELEX citation
 * against EUR-Lex CELLAR. Returns the obligation unchanged if no CELEX match.
 *
 * Called by Agent 2 during jurisdiction scouting to mark obligations as live.
 */
export async function enrichObligationFromEurLex(
  obligation: Obligation,
): Promise<Obligation> {
  const celexEntry = Object.entries(CELEX_MAP).find(([key, celex]) =>
    obligation.source.citation.includes(celex) ||
    obligation.source.citation.toLowerCase().includes(key),
  );
  if (!celexEntry) return obligation;

  const celexNumber = celexEntry[1];
  const metadata = await verifyCelex(celexNumber).catch(() => null);
  const isLive = metadata !== null && metadata.title !== null;

  return {
    ...obligation,
    source: {
      ...obligation.source,
      isLive,
      retrievedAt: new Date().toISOString(),
      url: `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celexNumber}`,
    },
  };
}
