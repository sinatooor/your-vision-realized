import fetch from "node-fetch";

const BASE_URL = "https://api.opensanctions.org";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SanctionsMatch = {
  entityId: string;
  name: string;
  score: number;
  datasets: string[];
  topics: string[];
  properties: {
    nationality: string[];
    birthDate: string[];
    position: string[];
    address: string[];
  };
};

export type ScreeningResult = {
  queryName: string;
  queryCountry: string | null;
  matched: boolean;
  matchCount: number;
  highestScore: number;
  isClean: boolean;
  matches: SanctionsMatch[];
  retrievedAt: string;
  apiKeyPresent: boolean;
};

export type BatchScreeningResult = {
  results: Map<string, ScreeningResult>;
  totalQueried: number;
  totalMatched: number;
  retrievedAt: string;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getApiKey(): string | null {
  return process.env.OPENSANCTIONS_API_KEY ?? null;
}

interface RawOSResult {
  id: string;
  caption: string;
  score: number;
  datasets: string[];
  properties?: {
    topics?: string[];
    nationality?: string[];
    birthDate?: string[];
    position?: string[];
    address?: string[];
  };
}

function parseMatch(r: RawOSResult): SanctionsMatch {
  return {
    entityId: r.id,
    name: r.caption,
    score: r.score,
    datasets: r.datasets,
    topics: r.properties?.topics ?? [],
    properties: {
      nationality: r.properties?.nationality ?? [],
      birthDate: r.properties?.birthDate ?? [],
      position: r.properties?.position ?? [],
      address: r.properties?.address ?? [],
    },
  };
}

function buildResult(
  name: string,
  country: string | undefined,
  rawResults: RawOSResult[],
): ScreeningResult {
  const matches = rawResults.map(parseMatch);
  const highestScore = matches.reduce((m, r) => Math.max(m, r.score), 0);
  return {
    queryName: name,
    queryCountry: country ?? null,
    matched: matches.length > 0,
    matchCount: matches.length,
    highestScore,
    isClean: matches.every((m) => m.score < 0.7),
    matches,
    retrievedAt: new Date().toISOString(),
    apiKeyPresent: true,
  };
}

function noKeyResult(name: string, country?: string): ScreeningResult {
  return {
    queryName: name,
    queryCountry: country ?? null,
    matched: false,
    matchCount: 0,
    highestScore: 0,
    isClean: true,
    matches: [],
    retrievedAt: new Date().toISOString(),
    apiKeyPresent: false,
  };
}

function errorResult(name: string, country?: string): ScreeningResult {
  return {
    queryName: name,
    queryCountry: country ?? null,
    matched: false,
    matchCount: 0,
    highestScore: 0,
    isClean: true,
    matches: [],
    retrievedAt: new Date().toISOString(),
    apiKeyPresent: true,
  };
}

async function postMatch(
  queries: Record<string, { schema: string; properties: Record<string, string[]> }>,
  apiKey: string,
): Promise<{ responses: Record<string, { results: RawOSResult[] }> }> {
  const res = await fetch(`${BASE_URL}/match/default`, {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ queries }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{
    responses: Record<string, { results: RawOSResult[] }>;
  }>;
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Screens a single entity name against all OpenSanctions datasets.
 * If no API key is configured, returns a clean result with a warning.
 * Called by Agent 2 to screen company directors and the entity itself.
 */
export async function screenEntity(
  name: string,
  country?: string,
): Promise<ScreeningResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn(
      "[OpenSanctions] No API key configured — skipping sanctions screening",
    );
    return noKeyResult(name, country);
  }

  const properties: Record<string, string[]> = { name: [name] };
  if (country) properties.country = [country];

  try {
    const data = await postMatch(
      { entity: { schema: "Person", properties } },
      apiKey,
    );
    const results = data?.responses?.entity?.results ?? [];
    return buildResult(name, country, results);
  } catch (err) {
    console.error(`[OpenSanctions] screenEntity("${name}") error:`, err);
    return errorResult(name, country);
  }
}

/**
 * Screens multiple entities in a single batched API call.
 * More efficient than calling screenEntity repeatedly.
 * Used when screening multiple directors at once.
 */
export async function screenMultipleEntities(
  entities: Array<{ name: string; country?: string }>,
): Promise<BatchScreeningResult> {
  const now = new Date().toISOString();
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn(
      "[OpenSanctions] No API key configured — skipping batch screening",
    );
    const results = new Map<string, ScreeningResult>();
    entities.forEach((e) => results.set(e.name, noKeyResult(e.name, e.country)));
    return {
      results,
      totalQueried: entities.length,
      totalMatched: 0,
      retrievedAt: now,
    };
  }

  try {
    const queries: Record<
      string,
      { schema: string; properties: Record<string, string[]> }
    > = {};
    entities.forEach((e, i) => {
      const props: Record<string, string[]> = { name: [e.name] };
      if (e.country) props.country = [e.country];
      queries[`q_${i}`] = { schema: "Person", properties: props };
    });

    const data = await postMatch(queries, apiKey);
    const results = new Map<string, ScreeningResult>();
    entities.forEach((e, i) => {
      const raw = data?.responses?.[`q_${i}`]?.results ?? [];
      results.set(e.name, buildResult(e.name, e.country, raw));
    });

    const totalMatched = [...results.values()].filter((r) => r.matched).length;
    return { results, totalQueried: entities.length, totalMatched, retrievedAt: now };
  } catch (err) {
    console.error("[OpenSanctions] screenMultipleEntities error:", err);
    return {
      results: new Map(),
      totalQueried: entities.length,
      totalMatched: 0,
      retrievedAt: now,
    };
  }
}

/**
 * Screens a company entity (not a person) for sanctions exposure.
 * Uses "Company" schema instead of "Person".
 */
export async function screenCompany(
  name: string,
  country?: string,
): Promise<ScreeningResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn(
      "[OpenSanctions] No API key configured — skipping company screening",
    );
    return noKeyResult(name, country);
  }

  const properties: Record<string, string[]> = { name: [name] };
  if (country) properties.country = [country];

  try {
    const data = await postMatch(
      { entity: { schema: "Company", properties } },
      apiKey,
    );
    const results = data?.responses?.entity?.results ?? [];
    return buildResult(name, country, results);
  } catch (err) {
    console.error(`[OpenSanctions] screenCompany("${name}") error:`, err);
    return errorResult(name, country);
  }
}
