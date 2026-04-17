import { readFileSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { SSEStream, emitAgent } from "../lib/sse";
import { ExpansionTwin, Obligation } from "../types";
import { enrichObligationFromEurLex, CELEX_MAP } from "../integrations/eurlex";
import { screenEntity } from "../integrations/opensanctions";
import { resolveGleifResult } from "../integrations/gleif";

const AGENT = "Agent 2 — Jurisdiction Scout";

const RULE_PACK_DIR = join(__dirname, "../data/rule-packs");

function loadRulePack(iso: string): Obligation[] {
  try {
    const raw = readFileSync(join(RULE_PACK_DIR, `${iso.toLowerCase()}.json`), "utf-8");
    return JSON.parse(raw) as Obligation[];
  } catch {
    return [];
  }
}

function filterByRelevance(obligations: Obligation[], twin: ExpansionTwin, country: string): Obligation[] {
  return obligations.filter((o) => {
    if (o.id.endsWith("-AI") || o.title.toLowerCase().includes("ai act")) {
      if (!twin.company.hasAiFeatures) return false;
    }
    const hires = twin.people.hiresByCountry[country] ?? 0;
    if (o.category === "employment" && hires === 0) return false;
    if (o.category === "tax" && o.title.toLowerCase().includes("payroll") && hires === 0) return false;
    return true;
  });
}

function assignObligationId(o: Obligation): Obligation {
  return { ...o, id: o.id || uuidv4() };
}

async function scoutCountry(
  country: string,
  twin: ExpansionTwin,
  stream: SSEStream,
): Promise<Obligation[]> {
  const pack = loadRulePack(country);
  const filtered = filterByRelevance(pack, twin, country).map(assignObligationId);

  const euCountries = ["DE", "SE", "FR", "NL", "BE", "PL", "AT", "DK", "FI"];
  if (euCountries.includes(country)) {
    const celexKeys = Object.keys(CELEX_MAP);
    const enriched = await Promise.allSettled(
      filtered
        .filter((o) => celexKeys.some((key) => {
          const celex = CELEX_MAP[key];
          return o.source.citation.includes(celex) || o.source.citation.toLowerCase().includes(key);
        }))
        .slice(0, 2)
        .map(async (o) => {
          emitAgent(stream, AGENT, "api_call", `Querying EUR-Lex SPARQL for ${o.title}…`);
          const enrichedObligation = await enrichObligationFromEurLex(o);
          emitAgent(stream, AGENT, "api_result", `${enrichedObligation.source.isLive ? "✓" : "○"} EUR-Lex: ${o.title} [${enrichedObligation.source.isLive ? "live" : "cached"}]`, {
            isLive: enrichedObligation.source.isLive,
          });
          return enrichedObligation;
        }),
    );
    const enrichedObligations = enriched
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<Obligation>).value);

    const enrichedIds = new Set(enrichedObligations.map((o) => o.id));
    return [...filtered.filter((o) => !enrichedIds.has(o.id)), ...enrichedObligations];
  }

  return filtered;
}

export async function scoutJurisdictions(
  twin: ExpansionTwin,
  stream: SSEStream,
): Promise<Obligation[]> {
  emitAgent(stream, AGENT, "agent_start", "Beginning jurisdiction intelligence retrieval…");

  const countries = [twin.company.hqCountry, ...twin.expansion.targetCountries];
  const unique = [...new Set(countries)];

  const countryResults = await Promise.allSettled(
    unique.map((c) => scoutCountry(c, twin, stream)),
  );

  const allObligations: Obligation[] = [];
  countryResults.forEach((result) => {
    if (result.status === "fulfilled") {
      allObligations.push(...result.value);
    }
  });

  // OpenSanctions screening
  emitAgent(stream, AGENT, "api_call", `Querying OpenSanctions /match for ${twin.company.name}…`);
  const screeningResult = await screenEntity(twin.company.name).catch(() => null);
  emitAgent(stream, AGENT, "api_result", `OpenSanctions: ${screeningResult ? (screeningResult.isClean ? "✓ Clean — no sanctions matches" : `⚠ ${screeningResult.matchCount} match(es) found`) : "○ Screening unavailable"}`, {
    isClean: screeningResult?.isClean ?? true,
    matchCount: screeningResult?.matchCount ?? 0,
  });

  // GLEIF entity resolution
  emitAgent(stream, AGENT, "api_call", `Querying GLEIF for ${twin.company.name}…`);
  const gleifResult = await resolveGleifResult(twin.company.name).catch(() => null);
  emitAgent(stream, AGENT, "api_result", `GLEIF: ${gleifResult?.entity ? `✓ Found — ${gleifResult.entity.legalName} (${gleifResult.entity.jurisdiction})` : "○ Entity not found in GLEIF registry"}`, {
    found: !!gleifResult?.entity,
    jurisdictions: gleifResult?.jurisdictions ?? [],
  });

  // Deduplication
  const seen = new Map<string, Obligation>();
  for (const o of allObligations) {
    const key = `${o.jurisdiction}:${o.title}`;
    const existing = seen.get(key);
    if (!existing || o.confidence > existing.confidence) {
      seen.set(key, o);
    }
  }
  const deduplicated = Array.from(seen.values());

  const byCountry = unique.reduce<Record<string, number>>((acc, c) => {
    acc[c] = deduplicated.filter((o) => o.jurisdiction === c).length;
    return acc;
  }, {});

  emitAgent(stream, AGENT, "agent_complete", `Retrieved ${deduplicated.length} obligations across ${unique.length} jurisdictions`, {
    total: deduplicated.length,
    byCountry,
  });

  return deduplicated;
}
