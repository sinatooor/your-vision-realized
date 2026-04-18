import fetch from "node-fetch";

const BASE_URL = "https://api.gleif.org/api/v1";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Spec types ───────────────────────────────────────────────────────────────

export type LEIEntity = {
  lei: string;
  legalName: string;
  jurisdiction: string;
  legalForm: string | null;
  status: string;
  registeredAddress: {
    country: string;
    city: string | null;
    postalCode: string | null;
  };
  parentLei: string | null;
  ultimateParentLei: string | null;
  sourceUrl: string;
  retrievedAt: string;
};

export type LEIParentChain = {
  entity: LEIEntity | null;
  directParent: LEIEntity | null;
  ultimateParent: LEIEntity | null;
  chainDepth: number;
};

// ─── Backward-compatible types kept for Agent 2 ───────────────────────────────

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

// ─── Cache ────────────────────────────────────────────────────────────────────

const entityCache = new Map<string, { data: LEIEntity; cachedAt: number }>();

function getCachedEntity(lei: string): LEIEntity | null {
  const entry = entityCache.get(lei);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    entityCache.delete(lei);
    return null;
  }
  return entry.data;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface RawLEIRecord {
  attributes?: {
    lei?: string;
    entity?: {
      legalName?: { name?: string };
      jurisdiction?: string;
      legalForm?: { name?: string };
      registeredAddress?: {
        country?: string;
        city?: string;
        postalCode?: string;
      };
    };
    registration?: { status?: string };
  };
}

function parseLEIEntity(item: RawLEIRecord, sourceUrl: string): LEIEntity {
  const attr = item.attributes ?? {};
  const ent = attr.entity ?? {};
  const addr = ent.registeredAddress ?? {};
  return {
    lei: attr.lei ?? "",
    legalName: ent.legalName?.name ?? "",
    jurisdiction: ent.jurisdiction ?? "",
    legalForm: ent.legalForm?.name ?? null,
    status: attr.registration?.status ?? "",
    registeredAddress: {
      country: addr.country ?? "",
      city: addr.city ?? null,
      postalCode: addr.postalCode ?? null,
    },
    parentLei: null,
    ultimateParentLei: null,
    sourceUrl,
    retrievedAt: new Date().toISOString(),
  };
}

function toLegacyEntity(e: LEIEntity | null): GleifEntity | null {
  if (!e) return null;
  return {
    lei: e.lei,
    legalName: e.legalName,
    jurisdiction: e.jurisdiction,
    status: e.status,
    parentLei: e.parentLei,
  };
}

// ─── Exported spec functions ──────────────────────────────────────────────────

/**
 * Searches GLEIF for entities matching a company name.
 * Returns up to 5 results ordered by relevance.
 * Called by Agent 2 to resolve corporate structure.
 */
export async function searchEntityByName(name: string): Promise<LEIEntity[]> {
  try {
    const sourceUrl = `${BASE_URL}/lei-records?filter[entity.legalName]=${encodeURIComponent(name)}&page[size]=5`;
    const res = await fetch(sourceUrl, {
      headers: { Accept: "application/vnd.api+json" },
    });
    if (!res.ok) {
      console.error(`[GLEIF] searchEntityByName HTTP ${res.status} for "${name}"`);
      return [];
    }
    const data = (await res.json()) as { data?: RawLEIRecord[] };
    return (data.data ?? []).map((item) => parseLEIEntity(item, sourceUrl));
  } catch (err) {
    console.error(`[GLEIF] searchEntityByName("${name}") error:`, err);
    return [];
  }
}

/**
 * Fetches a single entity by LEI code.
 */
export async function getEntityByLEI(lei: string): Promise<LEIEntity | null> {
  const cached = getCachedEntity(lei);
  if (cached) return cached;

  try {
    const sourceUrl = `${BASE_URL}/lei-records/${lei}`;
    const res = await fetch(sourceUrl, {
      headers: { Accept: "application/vnd.api+json" },
    });
    if (!res.ok) {
      if (res.status !== 404) {
        console.error(`[GLEIF] getEntityByLEI HTTP ${res.status} for "${lei}"`);
      }
      return null;
    }
    const data = (await res.json()) as { data?: RawLEIRecord };
    if (!data.data) return null;
    const entity = parseLEIEntity(data.data, sourceUrl);
    entityCache.set(lei, { data: entity, cachedAt: Date.now() });
    return entity;
  } catch (err) {
    console.error(`[GLEIF] getEntityByLEI("${lei}") error:`, err);
    return null;
  }
}

/**
 * Resolves the full parent chain for an entity up to 3 levels deep.
 * Used to identify UBO jurisdiction and group structure.
 */
export async function resolveParentChain(lei: string): Promise<LEIParentChain> {
  const errorResult: LEIParentChain = {
    entity: null,
    directParent: null,
    ultimateParent: null,
    chainDepth: 0,
  };

  try {
    const [entity, directRes, ultimateRes] = await Promise.all([
      getEntityByLEI(lei),
      fetch(`${BASE_URL}/lei-records/${lei}/direct-parent`, {
        headers: { Accept: "application/vnd.api+json" },
      }).catch(() => null),
      fetch(`${BASE_URL}/lei-records/${lei}/ultimate-parent`, {
        headers: { Accept: "application/vnd.api+json" },
      }).catch(() => null),
    ]);

    let directParent: LEIEntity | null = null;
    if (directRes?.ok) {
      const data = (await directRes.json()) as { data?: RawLEIRecord };
      if (data.data) {
        directParent = parseLEIEntity(
          data.data,
          `${BASE_URL}/lei-records/${lei}/direct-parent`,
        );
      }
    }

    let ultimateParent: LEIEntity | null = null;
    if (ultimateRes?.ok) {
      const data = (await ultimateRes.json()) as { data?: RawLEIRecord };
      if (data.data) {
        ultimateParent = parseLEIEntity(
          data.data,
          `${BASE_URL}/lei-records/${lei}/ultimate-parent`,
        );
      }
    }

    let chainDepth = 0;
    if (directParent) chainDepth = 1;
    if (ultimateParent && ultimateParent.lei !== directParent?.lei) chainDepth = 2;

    return { entity, directParent, ultimateParent, chainDepth };
  } catch (err) {
    console.error(`[GLEIF] resolveParentChain("${lei}") error:`, err);
    return errorResult;
  }
}

// ─── Backward-compatible functions for Agent 2 ───────────────────────────────

/** @deprecated Use searchEntityByName instead. */
export async function searchEntity(name: string): Promise<GleifEntity[]> {
  const entities = await searchEntityByName(name);
  return entities.map(toLegacyEntity).filter((e): e is GleifEntity => e !== null);
}

/** @deprecated Use getEntityByLEI instead. */
export async function getEntityByLei(lei: string): Promise<GleifEntity | null> {
  return toLegacyEntity(await getEntityByLEI(lei));
}

/**
 * Resolves GLEIF entity and parent chain for Agent 2 compatibility.
 * Returns the entity, its parents, and all observed jurisdictions.
 */
export async function resolveGleifResult(companyName: string): Promise<GleifResult> {
  const entities = await searchEntityByName(companyName);
  if (entities.length === 0) {
    return {
      entity: null,
      parent: null,
      ultimateParent: null,
      jurisdictions: [],
      sanctionsRisk: false,
    };
  }

  const top = entities[0]!;
  const jurisdictions: string[] = top.jurisdiction ? [top.jurisdiction] : [];

  let parent: GleifEntity | null = null;
  let ultimateParent: GleifEntity | null = null;

  if (top.lei) {
    const chain = await resolveParentChain(top.lei);
    if (chain.directParent) {
      parent = toLegacyEntity(chain.directParent);
      if (chain.directParent.jurisdiction) jurisdictions.push(chain.directParent.jurisdiction);
    }
    if (chain.ultimateParent) {
      ultimateParent = toLegacyEntity(chain.ultimateParent);
      if (chain.ultimateParent.jurisdiction) jurisdictions.push(chain.ultimateParent.jurisdiction);
    }
  }

  return {
    entity: toLegacyEntity(top),
    parent,
    ultimateParent,
    jurisdictions: [...new Set(jurisdictions)],
    sanctionsRisk: false,
  };
}
