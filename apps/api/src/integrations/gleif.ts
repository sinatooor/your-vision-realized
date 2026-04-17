const BASE_URL = "https://api.gleif.org/api/v1";
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface GleifEntity {
  lei: string;
  legalName: string;
  jurisdiction: string;
  status: string;
  parentLei: string | null;
}

export interface GleifResult {
  entity: GleifEntity | null;
  parent: GleifEntity | null;
  ultimateParent: GleifEntity | null;
  jurisdictions: string[];
  sanctionsRisk: boolean;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, cachedAt: Date.now() });
}

function parseEntity(raw: {
  attributes?: {
    lei?: string;
    entity?: {
      legalName?: { name?: string };
      jurisdiction?: string;
      status?: string;
    };
    relationships?: {
      "direct-parent"?: { data?: { id?: string } };
    };
  };
}): GleifEntity {
  return {
    lei: raw.attributes?.lei ?? "",
    legalName: raw.attributes?.entity?.legalName?.name ?? "",
    jurisdiction: raw.attributes?.entity?.jurisdiction ?? "",
    status: raw.attributes?.entity?.status ?? "",
    parentLei: raw.attributes?.relationships?.["direct-parent"]?.data?.id ?? null,
  };
}

export async function searchEntity(name: string): Promise<GleifEntity[]> {
  const cacheKey = `search:${name}`;
  const cached = getCached<GleifEntity[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/lei-records?filter[entity.legalName]=${encodeURIComponent(name)}&page[size]=5`;
    const res = await fetch(url, { headers: { Accept: "application/vnd.api+json" } });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: unknown[] };
    const entities = (data.data ?? []).map((item) => parseEntity(item as Parameters<typeof parseEntity>[0]));
    setCache(cacheKey, entities);
    return entities;
  } catch {
    return [];
  }
}

export async function getEntityByLei(lei: string): Promise<GleifEntity | null> {
  const cacheKey = `lei:${lei}`;
  const cached = getCached<GleifEntity>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE_URL}/lei-records/${lei}`, {
      headers: { Accept: "application/vnd.api+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: unknown };
    if (!data.data) return null;
    const entity = parseEntity(data.data as Parameters<typeof parseEntity>[0]);
    setCache(cacheKey, entity);
    return entity;
  } catch {
    return null;
  }
}

export async function resolveGleifResult(companyName: string): Promise<GleifResult> {
  const entities = await searchEntity(companyName);
  if (entities.length === 0) {
    return { entity: null, parent: null, ultimateParent: null, jurisdictions: [], sanctionsRisk: false };
  }

  const entity = entities[0];
  const jurisdictions = [entity.jurisdiction].filter(Boolean);

  let parent: GleifEntity | null = null;
  let ultimateParent: GleifEntity | null = null;

  if (entity.parentLei) {
    parent = await getEntityByLei(entity.parentLei);
    if (parent?.jurisdiction) jurisdictions.push(parent.jurisdiction);
    if (parent?.parentLei) {
      ultimateParent = await getEntityByLei(parent.parentLei);
      if (ultimateParent?.jurisdiction) jurisdictions.push(ultimateParent.jurisdiction);
    }
  }

  return {
    entity,
    parent,
    ultimateParent,
    jurisdictions: [...new Set(jurisdictions)],
    sanctionsRisk: false,
  };
}
