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
