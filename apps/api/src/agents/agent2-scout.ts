import { readFileSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { SSEStream, emitAgent } from "../lib/sse";
import { ExpansionTwin, Obligation } from "../types";
import { enrichObligationFromEurLex, CELEX_MAP, loadUpcomingObligations } from "../integrations/eurlex";
import { screenEntity, screenCompany, screenMultipleEntities } from "../integrations/opensanctions";
import { resolveGleifResult } from "../integrations/gleif";
import { searchCompany, getCompanyOfficers } from "../integrations/companies-house";
import { validateVATNumber } from "../integrations/vies";
import { fetchTargetCountryNews, NewsScoutResult } from "../integrations/perplexity-news";

const AGENT = "Agent 2 — Jurisdiction Scout";

const RULE_PACK_DIR = join(__dirname, "../data/rule-packs");

const EU_MEMBER_STATES = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR",
  "HR","HU","IE","IT","LT","LU","LV","MT","NL","PL","PT","RO",
  "SE","SI","SK",
]);

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

  if (EU_MEMBER_STATES.has(country)) {
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

export interface ScoutOutput {
  obligations: Obligation[];
  recentDevelopments: NewsScoutResult[];
}

export async function scoutJurisdictions(
  twin: ExpansionTwin,
  stream: SSEStream,
): Promise<ScoutOutput> {
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

  // ── OpenSanctions: screen entity as person ──────────────────────────────────
  emitAgent(stream, AGENT, "api_call", `Querying OpenSanctions for ${twin.company.name} (entity)…`);
  const personScreening = await screenEntity(twin.company.name, twin.company.hqCountry).catch(() => null);
  emitAgent(stream, AGENT, "api_result",
    `OpenSanctions (entity): ${personScreening
      ? personScreening.isClean
        ? "✓ Clean"
        : `⚠ ${personScreening.matchCount} match(es) — score ${personScreening.highestScore.toFixed(2)}`
      : "○ Unavailable"}`,
    { isClean: personScreening?.isClean ?? true, matchCount: personScreening?.matchCount ?? 0 },
  );

  // ── OpenSanctions: screen as Company ───────────────────────────────────────
  emitAgent(stream, AGENT, "api_call", `Querying OpenSanctions for ${twin.company.name} (company)…`);
  const companyScreening = await screenCompany(twin.company.name, twin.company.hqCountry).catch(() => null);
  emitAgent(stream, AGENT, "api_result",
    `OpenSanctions (company): ${companyScreening
      ? companyScreening.isClean
        ? "✓ Clean"
        : `⚠ ${companyScreening.matchCount} match(es) — score ${companyScreening.highestScore.toFixed(2)}`
      : "○ Unavailable"}`,
    { isClean: companyScreening?.isClean ?? true, matchCount: companyScreening?.matchCount ?? 0 },
  );

  // ── GLEIF entity resolution ─────────────────────────────────────────────────
  emitAgent(stream, AGENT, "api_call", `Querying GLEIF for ${twin.company.name}…`);
  const gleifResult = await resolveGleifResult(twin.company.name).catch(() => null);
  emitAgent(stream, AGENT, "api_result",
    `GLEIF: ${gleifResult?.entity
      ? `✓ Found — ${gleifResult.entity.legalName} (${gleifResult.entity.jurisdiction})${gleifResult.jurisdictions.length > 1 ? ` — group spans ${gleifResult.jurisdictions.join(", ")}` : ""}`
      : "○ Entity not found in GLEIF registry"}`,
    { found: !!gleifResult?.entity, jurisdictions: gleifResult?.jurisdictions ?? [] },
  );

  // ── Companies House (GB only) ───────────────────────────────────────────────
  if (unique.includes("GB")) {
    emitAgent(stream, AGENT, "api_call", `Querying Companies House for ${twin.company.name}…`);
    const chResults = await searchCompany(twin.company.name).catch(() => []);

    if (chResults.length > 0) {
      const top = chResults[0]!;
      emitAgent(stream, AGENT, "api_result",
        `Companies House: ✓ ${top.companyName} — ${top.companyStatus} (${top.companyType})`,
        { companyNumber: top.companyNumber, status: top.companyStatus },
      );

      const officers = await getCompanyOfficers(top.companyNumber).catch(() => []);
      if (officers.length > 0) {
        emitAgent(stream, AGENT, "api_call", `Screening ${officers.length} director(s) via OpenSanctions…`);
        const dirScreening = await screenMultipleEntities(
          officers.map((o) => ({ name: o.name, country: "GB" })),
        ).catch(() => null);

        const flagged = dirScreening
          ? [...dirScreening.results.values()].filter((r) => !r.isClean).length
          : 0;
        emitAgent(stream, AGENT, "api_result",
          flagged > 0
            ? `⚠ Directors: ${flagged} of ${officers.length} flagged in sanctions lists`
            : `✓ Directors: All ${officers.length} clear (OpenSanctions)`,
          { flagged, total: officers.length },
        );
      }
    } else {
      emitAgent(stream, AGENT, "api_result",
        `Companies House: ○ ${twin.company.name} not found in UK registry`,
        { found: false },
      );
    }
  }

  // ── VIES (EU presence check) ────────────────────────────────────────────────
  const euTargets = unique.filter((c) => EU_MEMBER_STATES.has(c));
  if (euTargets.length > 0) {
    // If the twin's rawBrief contains a VAT number pattern, attempt to validate it
    const vatPattern = /\b([A-Z]{2})\s*([0-9A-Z]{8,12})\b/g;
    const vatMatches = [...twin.rawBrief.matchAll(vatPattern)];
    const euVatMatches = vatMatches.filter(([, cc]) => EU_MEMBER_STATES.has(cc!));

    if (euVatMatches.length > 0) {
      emitAgent(stream, AGENT, "api_call", `Validating ${euVatMatches.length} VAT number(s) via VIES…`);
      const vatResults = await Promise.allSettled(
        euVatMatches.map(([, cc, num]) => validateVATNumber(cc!, num!)),
      );
      const valid = vatResults.filter(
        (r) => r.status === "fulfilled" && r.value.valid === true,
      ).length;
      const unavailable = vatResults.filter(
        (r) => r.status === "fulfilled" && r.value.valid === null,
      ).length;
      emitAgent(stream, AGENT, "api_result",
        `VIES: ${valid} valid, ${euVatMatches.length - valid - unavailable} invalid, ${unavailable} service unavailable`,
        { valid, total: euVatMatches.length },
      );
    } else {
      emitAgent(stream, AGENT, "api_result",
        `VIES: ○ EU presence detected (${euTargets.join(", ")}) — include VAT numbers in brief for live validation`,
        { countriesInScope: euTargets },
      );
    }
  }

  // ── Deduplication ───────────────────────────────────────────────────────────
  const seen = new Map<string, Obligation>();
  for (const o of allObligations) {
    const key = `${o.jurisdiction}:${o.title}`;
    const existing = seen.get(key);
    if (!existing || o.confidence > existing.confidence) {
      seen.set(key, o);
    }
  }
  const deduplicated = Array.from(seen.values());

  // ── EUR-Lex upcoming/proposed legislation ───────────────────────────────────
  const euCountries = unique.filter((c) => EU_MEMBER_STATES.has(c));
  if (euCountries.length > 0) {
    emitAgent(stream, AGENT, "api_call", `Loading upcoming EU legislation for ${euCountries.join(", ")}…`);
    const upcoming = await loadUpcomingObligations(euCountries, twin.company.industry).catch(() => [] as Obligation[]);
    if (upcoming.length > 0) {
      const upcomingIds = new Set(upcoming.map((o) => o.id));
      deduplicated.push(...upcoming.filter((o) => !upcomingIds.has(o.id) || !deduplicated.some((d) => d.id === o.id)));
      emitAgent(stream, AGENT, "api_result",
        `EUR-Lex upcoming: ${upcoming.length} proposed/upcoming instrument(s) added`,
        { count: upcoming.length, laws: upcoming.map((o) => o.title) },
      );
    } else {
      emitAgent(stream, AGENT, "api_result", "EUR-Lex upcoming: no matching instruments for this jurisdiction/industry", {});
    }
  }

  const byCountry = unique.reduce<Record<string, number>>((acc, c) => {
    acc[c] = deduplicated.filter((o) => o.jurisdiction === c).length;
    return acc;
  }, {});

  // ── Perplexity News Scout (target jurisdictions only) ──────────────────────
  const recentDevelopments: NewsScoutResult[] = [];
  for (const target of twin.expansion.targetCountries) {
    emitAgent(stream, AGENT, "api_call", `Scouting recent regulatory news for ${target} (last 30 days)…`);
    const news = await fetchTargetCountryNews(target, twin.company.industry).catch(() => null);
    if (news) {
      recentDevelopments.push(news);
      emitAgent(stream, AGENT, "api_result",
        `${news.isLive ? "✓" : "○"} News (${news.countryName}): ${news.isLive ? `${news.highlights.length} item(s), ${news.citations.length} source(s)` : news.reason ?? "unavailable"}`,
        { isLive: news.isLive, highlights: news.highlights.length, citations: news.citations.length },
      );
    }
  }

  emitAgent(stream, AGENT, "agent_complete",
    `Retrieved ${deduplicated.length} obligations across ${unique.length} jurisdictions`,
    { total: deduplicated.length, byCountry },
  );

  return { obligations: deduplicated, recentDevelopments };
}
