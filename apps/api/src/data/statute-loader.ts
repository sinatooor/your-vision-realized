import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Obligation } from "../types";

const RAW_DIR = join(__dirname, "raw");

// ─── Citation → file mappings ─────────────────────────────────────────────────

/** Maps citation keywords to German law file abbreviations in raw/de/ */
const DE_LAW_MAP: Array<{ keywords: string[]; abbr: string; title: string }> = [
  { keywords: ["BetrVG", "Betriebsverfassungsgesetz"], abbr: "betrvg", title: "BetrVG" },
  { keywords: ["EStG", "Einkommensteuergesetz"], abbr: "estg", title: "EStG" },
  { keywords: [" AO", "Abgabenordnung", "AO 1977"], abbr: "ao_1977", title: "AO" },
  { keywords: ["GmbHG"], abbr: "gmbhg", title: "GmbHG" },
  { keywords: ["SGB IV", "SGB 4", "Sozialgesetzbuch"], abbr: "sgb_4", title: "SGB IV" },
];

/** Maps citation keywords to UK law slugs in raw/gb/ */
const GB_LAW_MAP: Array<{ keywords: string[]; slug: string; title: string }> = [
  {
    keywords: ["Employment Rights Act", "ERA 1996", "ERA s.", "ERA,"],
    slug: "employment-rights-act-1996",
    title: "Employment Rights Act 1996",
  },
  {
    keywords: ["Data Protection Act", "DPA 2018", "DPA,", "DPA s."],
    slug: "data-protection-act-2018",
    title: "Data Protection Act 2018",
  },
  {
    keywords: ["PECR", "Privacy and Electronic Communications"],
    slug: "privacy-and-electronic-communications-regulations-2003",
    title: "Privacy and Electronic Communications Regulations 2003",
  },
];

/** Maps citation keywords to CELEX numbers for EU laws in raw/eu/ */
const EU_LAW_MAP: Array<{ keywords: string[]; celex: string; title: string }> = [
  {
    keywords: ["GDPR", "32016R0679", "General Data Protection"],
    celex: "32016R0679",
    title: "GDPR",
  },
  {
    keywords: ["AI Act", "32024R1689", "Artificial Intelligence Act"],
    celex: "32024R1689",
    title: "EU AI Act",
  },
  {
    keywords: ["CSRD", "32022L2464", "Corporate Sustainability Reporting"],
    celex: "32022L2464",
    title: "CSRD",
  },
];

// ─── Raw JSON shapes ──────────────────────────────────────────────────────────

interface RawGermanNorm {
  paragraphId: string;
  textContent: string;
  hasContent: boolean;
}

interface RawGermanLaw {
  shortTitle: string;
  norms: RawGermanNorm[];
}

interface RawUKSection {
  sectionNumber: string;
  sectionTitle: string;
  textContent: string;
  hasContent: boolean;
}

interface RawUKLegislation {
  title: string;
  sections: RawUKSection[];
}

interface RawEUArticle {
  articleText: string | null;
}

interface RawEULaw {
  celexNumber: string;
  articles: Record<string, RawEUArticle>;
}

// ─── Output type ──────────────────────────────────────────────────────────────

export type StatuteExcerpt = {
  citation: string;
  jurisdiction: string;
  lawTitle: string;
  sectionId: string;
  text: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadJSON<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

/** Extracts a German paragraph reference ("§ 12") from a citation string. */
function extractGermanParagraph(citation: string): string | null {
  const m = citation.match(/§\s*(\d+[a-zA-Z]?)/);
  return m ? `§ ${m[1]!}` : null;
}

/** Extracts a UK section number ("94", "13A") from a citation string. */
function extractUKSection(citation: string): string | null {
  const m = citation.match(/(?:s(?:ection)?\.?\s*|Art(?:icle)?\.?\s*)(\d+[a-zA-Z]?)/i);
  return m ? m[1]! : null;
}

/** Extracts an EU article number ("5", "28") from a citation string. */
function extractEUArticle(citation: string): string | null {
  const m = citation.match(/Art(?:icle)?\.?\s*(\d+[a-zA-Z]?)/i);
  return m ? m[1]! : null;
}

function matchesKeywords(citation: string, keywords: string[]): boolean {
  return keywords.some((k) => citation.includes(k));
}

// ─── Per-jurisdiction loaders ─────────────────────────────────────────────────

function loadDEExcerpt(citation: string): StatuteExcerpt | null {
  const entry = DE_LAW_MAP.find((e) => matchesKeywords(citation, e.keywords));
  if (!entry) return null;

  const law = loadJSON<RawGermanLaw>(join(RAW_DIR, "de", `${entry.abbr}.json`));
  if (!law) return null;

  const paraRef = extractGermanParagraph(citation);
  if (!paraRef) return null;

  const norm = law.norms.find((n) => n.paragraphId === paraRef && n.hasContent);
  if (!norm) return null;

  return {
    citation,
    jurisdiction: "DE",
    lawTitle: entry.title,
    sectionId: paraRef,
    text: norm.textContent.slice(0, 600),
  };
}

function loadGBExcerpt(citation: string): StatuteExcerpt | null {
  const entry = GB_LAW_MAP.find((e) => matchesKeywords(citation, e.keywords));
  if (!entry) return null;

  const leg = loadJSON<RawUKLegislation>(join(RAW_DIR, "gb", `${entry.slug}.json`));
  if (!leg) return null;

  const sectionRef = extractUKSection(citation);
  if (!sectionRef) return null;

  const section = leg.sections.find((s) => s.sectionNumber === sectionRef && s.hasContent);
  if (!section) return null;

  return {
    citation,
    jurisdiction: "GB",
    lawTitle: entry.title,
    sectionId: `s. ${sectionRef}`,
    text: section.textContent.slice(0, 600),
  };
}

function loadEUExcerpt(citation: string): StatuteExcerpt | null {
  const entry = EU_LAW_MAP.find((e) => matchesKeywords(citation, e.keywords));
  if (!entry) return null;

  const law = loadJSON<RawEULaw>(join(RAW_DIR, "eu", `${entry.celex}.json`));
  if (!law?.articles) return null;

  const articleRef = extractEUArticle(citation);
  if (!articleRef) return null;

  const article = law.articles[articleRef];
  if (!article?.articleText) return null;

  return {
    citation,
    jurisdiction: "EU",
    lawTitle: entry.title,
    sectionId: `Art. ${articleRef}`,
    text: article.articleText.slice(0, 600),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Loads real statute text for a set of obligations from pre-fetched raw files.
 * Returns an empty array if raw files are absent — this is an optional enhancement.
 */
export function loadStatuteExcerpts(obligations: Obligation[]): StatuteExcerpt[] {
  const seen = new Set<string>();
  const excerpts: StatuteExcerpt[] = [];

  for (const ob of obligations) {
    const key = `${ob.jurisdiction}:${ob.source.citation}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let excerpt: StatuteExcerpt | null = null;

    if (ob.jurisdiction === "DE") excerpt = loadDEExcerpt(ob.source.citation);
    else if (ob.jurisdiction === "GB") excerpt = loadGBExcerpt(ob.source.citation);
    else excerpt = loadEUExcerpt(ob.source.citation);

    if (excerpt) excerpts.push(excerpt);
  }

  return excerpts;
}

/**
 * Formats statute excerpts into a block ready to inject into a Claude prompt.
 * Returns an empty string if no excerpts are available.
 */
export function formatStatuteContext(excerpts: StatuteExcerpt[]): string {
  if (excerpts.length === 0) return "";

  return excerpts
    .map((e) => `[${e.jurisdiction} — ${e.lawTitle}, ${e.sectionId}]\n${e.text}`)
    .join("\n\n---\n\n");
}
