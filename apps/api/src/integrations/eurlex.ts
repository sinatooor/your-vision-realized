import { Obligation } from "../types";
import { readFileSync } from "fs";
import { join } from "path";

const SPARQL_ENDPOINT = "https://publications.europa.eu/webapi/rdf/sparql";
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  data: string;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

export interface EurLexResult {
  celexNumber: string;
  title: string;
  summary: string;
  url: string;
}

function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: string): void {
  cache.set(key, { data, cachedAt: Date.now() });
}

async function sparqlQuery(query: string): Promise<unknown> {
  const params = new URLSearchParams({ query, format: "application/sparql-results+json" });
  const url = `${SPARQL_ENDPOINT}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/sparql-results+json" },
  });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    const retry = await fetch(url, {
      headers: { Accept: "application/sparql-results+json" },
    });
    if (!retry.ok) throw new Error(`EUR-Lex SPARQL error: ${retry.status}`);
    return retry.json();
  }
  if (!res.ok) throw new Error(`EUR-Lex SPARQL error: ${res.status}`);
  return res.json();
}

export async function fetchLegislationText(celexNumber: string): Promise<{ text: string; isLive: boolean }> {
  const cacheKey = `text:${celexNumber}`;
  const cached = getCached(cacheKey);
  if (cached) return { text: cached, isLive: false };

  const localFallback = loadLocalCache(celexNumber);
  if (localFallback) {
    setCache(cacheKey, localFallback);
    return { text: localFallback, isLive: false };
  }

  try {
    const query = `
      PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
      SELECT ?title WHERE {
        ?work cdm:resource_legal_id_celex "${celexNumber}" .
        ?work cdm:title ?title .
        FILTER(LANG(?title) = "en" || LANG(?title) = "")
      }
      LIMIT 1
    `;
    const result = (await sparqlQuery(query)) as {
      results: { bindings: Array<{ title?: { value: string } }> };
    };
    const binding = result?.results?.bindings?.[0];
    const text = binding?.title?.value ?? `${celexNumber} — legislation retrieved`;
    setCache(cacheKey, text);
    return { text, isLive: true };
  } catch {
    const fallback = `${celexNumber} — EUR-Lex legislation (cached)`;
    return { text: fallback, isLive: false };
  }
}

function loadLocalCache(celexNumber: string): string | null {
  try {
    const cachePath = join(__dirname, "../cache/eurlex", `${celexNumber}.txt`);
    return readFileSync(cachePath, "utf-8");
  } catch {
    return null;
  }
}

export async function fetchByKeyword(
  keyword: string,
  _jurisdiction: string,
): Promise<EurLexResult[]> {
  const cacheKey = `kw:${keyword}`;
  const cached = getCached(cacheKey);
  if (cached) return JSON.parse(cached) as EurLexResult[];

  try {
    const query = `
      PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
      SELECT ?work ?celex ?title WHERE {
        ?work cdm:resource_legal_id_celex ?celex .
        ?work cdm:title ?title .
        FILTER(CONTAINS(LCASE(STR(?title)), LCASE("${keyword}")))
        FILTER(LANG(?title) = "en" || LANG(?title) = "")
      }
      LIMIT 5
    `;
    const result = (await sparqlQuery(query)) as {
      results: { bindings: Array<{ celex?: { value: string }; title?: { value: string } }> };
    };
    const items: EurLexResult[] = (result?.results?.bindings ?? []).map((b) => ({
      celexNumber: b.celex?.value ?? "",
      title: b.title?.value ?? "",
      summary: "",
      url: `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${b.celex?.value ?? ""}`,
    }));
    setCache(cacheKey, JSON.stringify(items));
    return items;
  } catch {
    return [];
  }
}

export const CELEX_MAP: Record<string, string> = {
  gdpr: "32016R0679",
  "ai-act": "32024R1689",
  csrd: "32022L2464",
  dac7: "32021R0821",
};

export async function enrichObligationFromEurLex(
  obligation: Obligation,
): Promise<Obligation> {
  const celexEntry = Object.entries(CELEX_MAP).find(([, celex]) =>
    obligation.source.citation.includes(celex),
  );
  if (!celexEntry) return obligation;

  const { text, isLive } = await fetchLegislationText(celexEntry[1]);
  return {
    ...obligation,
    source: {
      ...obligation.source,
      isLive,
      retrievedAt: new Date().toISOString(),
      url: `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celexEntry[1]}`,
    },
    description: obligation.description || text.slice(0, 200),
  };
}
