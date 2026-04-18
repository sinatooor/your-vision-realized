import * as fs from "fs";
import * as path from "path";

import { fetchMultipleGermanLaws } from "./sources/german-law";
import { fetchMultipleUKLaws } from "./sources/uk-law";
import { prefetchEULaws, EULaw } from "../integrations/eurlex";
import { searchEntityByName } from "../integrations/gleif";
import { validateVATNumber } from "../integrations/vies";
import { screenEntity } from "../integrations/opensanctions";
import { searchCompany } from "../integrations/companies-house";

// ─── Paths ────────────────────────────────────────────────────────────────────

const RAW_DIR = path.join(__dirname, "raw");
const DE_DIR = path.join(RAW_DIR, "de");
const GB_DIR = path.join(RAW_DIR, "gb");
const EU_DIR = path.join(RAW_DIR, "eu");

// ─── Source lists ─────────────────────────────────────────────────────────────

const DE_ABBREVIATIONS = ["betrvg", "estg", "ao_1977", "tmg", "gmbhg", "sgb_4"];

const GB_LAWS = [
  { path: "/ukpga/1996/18/data.xml", title: "Employment Rights Act 1996" },
  { path: "/ukpga/2018/12/data.xml", title: "Data Protection Act 2018" },
  { path: "/ukpga/2006/46/data.xml", title: "Companies Act 2006" },
  {
    path: "/uksi/2003/2682/data.xml",
    title: "Privacy and Electronic Communications Regulations 2003",
  },
];

const EU_LAWS = [
  { celex: "32016R0679", articleNumbers: ["5", "6", "9", "28", "44", "46"] },
  { celex: "32024R1689", articleNumbers: ["6", "9", "13", "16", "43", "49"] },
  { celex: "32022L2464", articleNumbers: ["1", "3", "19", "29"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** JSON.stringify replacer that serialises Map → plain object. */
function mapReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) return Object.fromEntries(value);
  return value;
}

function writeJSON(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, mapReplacer, 2), "utf-8");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startMs = Date.now();

  // ── 1. Create output directories ────────────────────────────────────────────
  [DE_DIR, GB_DIR, EU_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

  // ── 2. Fetch German laws ─────────────────────────────────────────────────────
  console.log("\n[DE] Fetching German federal laws…");
  const deMap = await fetchMultipleGermanLaws(DE_ABBREVIATIONS);
  let deTotalNorms = 0;

  for (const [abbr, law] of deMap) {
    const chars = law.norms.reduce((sum, n) => sum + n.textContent.length, 0);
    deTotalNorms += law.norms.length;
    writeJSON(path.join(DE_DIR, `${abbr}.json`), law);
    console.log(
      `[DE] ${abbr} → ${law.norms.length} norms (${chars.toLocaleString()} chars)`,
    );
  }

  // ── 3. Fetch UK statutes ──────────────────────────────────────────────────────
  console.log("\n[GB] Fetching UK statutes…");
  const gbMap = await fetchMultipleUKLaws(GB_LAWS);
  let gbTotalSections = 0;

  for (const [title, leg] of gbMap) {
    const chars = leg.sections.reduce((sum, s) => sum + s.textContent.length, 0);
    gbTotalSections += leg.sections.length;
    const slug = slugify(title);
    writeJSON(path.join(GB_DIR, `${slug}.json`), leg);
    console.log(
      `[GB] ${slug} → ${leg.sections.length} sections (${chars.toLocaleString()} chars)`,
    );
  }

  // ── 4. Pre-fetch EU laws ──────────────────────────────────────────────────────
  console.log("\n[EU] Pre-fetching EU laws…");
  const euMap = await prefetchEULaws(EU_LAWS);
  let euTotalArticles = 0;

  for (const [celex, euLaw] of euMap) {
    euTotalArticles += euLaw.articles.size;
    writeJSON(path.join(EU_DIR, `${celex}.json`), euLaw);
    console.log(
      `[EU] ${celex} → metadata ok, ${euLaw.articles.size} articles cached`,
    );
  }

  // ── 5. Integration tests ──────────────────────────────────────────────────────
  console.log("\n[CHECK] Running live API integration tests…");

  let gleifOk = false;
  let viesOk = false;
  let viesAvailable = false;
  let sanctionsOk = false;
  let sanctionsKeyPresent = false;
  let chOk = false;

  // GLEIF
  try {
    const gleifResults = await searchEntityByName("Spotify AB");
    gleifOk = true;
    const first = gleifResults[0];
    console.log(
      `[CHECK] GLEIF: ${gleifResults.length} result(s)` +
        (first ? ` — first jurisdiction: ${first.jurisdiction || "(none)"}` : ""),
    );
  } catch (err) {
    console.error("[CHECK] GLEIF error:", err);
  }

  // VIES
  try {
    const viesResult = await validateVATNumber("SE", "556703748500");
    viesOk = true;
    viesAvailable = viesResult.serviceAvailable;
    const status = viesResult.valid === null ? "unavailable" : viesResult.valid ? "valid" : "invalid";
    console.log(`[CHECK] VIES: ${status} (serviceAvailable=${viesResult.serviceAvailable})`);
  } catch (err) {
    console.error("[CHECK] VIES error:", err);
  }

  // OpenSanctions
  try {
    const sr = await screenEntity("Test Entity", "SE");
    sanctionsOk = true;
    sanctionsKeyPresent = sr.apiKeyPresent;
    console.log(
      `[CHECK] OpenSanctions: apiKeyPresent=${sr.apiKeyPresent}, isClean=${sr.isClean}`,
    );
  } catch (err) {
    console.error("[CHECK] OpenSanctions error:", err);
  }

  // Companies House
  try {
    const chResults = await searchCompany("Revolut");
    chOk = true;
    if (chResults.length > 0) {
      console.log(`[CHECK] CompaniesHouse: ${chResults.length} result(s)`);
    } else if (!process.env.COMPANIES_HOUSE_API_KEY) {
      console.log("[CHECK] CompaniesHouse: no key configured");
    } else {
      console.log("[CHECK] CompaniesHouse: 0 results");
    }
  } catch (err) {
    console.error("[CHECK] CompaniesHouse error:", err);
    if (!process.env.COMPANIES_HOUSE_API_KEY) {
      chOk = true; // graceful degradation counts as ok
      console.log("[CHECK] CompaniesHouse: no key configured");
    }
  }

  // ── 6. Summary ────────────────────────────────────────────────────────────────
  const elapsedS = ((Date.now() - startMs) / 1000).toFixed(1);

  const gleifMark = gleifOk ? "✓" : "✗";
  const viesMark = viesOk ? (viesAvailable ? "✓" : "⚠") : "✗";
  const sanctionsMark = sanctionsOk ? (sanctionsKeyPresent ? "✓" : "⚠") : "✗";
  const chMark = chOk ? (process.env.COMPANIES_HOUSE_API_KEY ? "✓" : "⚠") : "✗";

  console.log("\n═══════════════════════════════════");
  console.log("JurisdictIQ data layer — build complete");
  console.log(`DE laws:     ${deMap.size} fetched, ${deTotalNorms} total norms`);
  console.log(
    `GB statutes: ${gbMap.size} fetched, ${gbTotalSections} total sections`,
  );
  console.log(`EU laws:     ${euMap.size} fetched, ${euTotalArticles} articles cached`);
  console.log(
    `API checks:  GLEIF ${gleifMark}  VIES ${viesMark}  OpenSanctions ${sanctionsMark}  CompaniesHouse ${chMark}`,
  );
  console.log(`Raw files:   apps/api/src/data/raw/`);
  console.log(`Build time:  ${elapsedS}s`);
  console.log("═══════════════════════════════════\n");

  // ── 7. Exit code ──────────────────────────────────────────────────────────────
  if (deMap.size === 0 && gbMap.size === 0) {
    console.error("[FATAL] All German and UK law fetches failed — check environment");
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[FATAL] fetch-sources crashed:", err);
  process.exit(1);
});
