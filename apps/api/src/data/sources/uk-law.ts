import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";

const BASE_URL = "https://www.legislation.gov.uk";

const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: true,
  trimValues: true,
};

// ─── Local types (not exported to packages/types) ────────────────────────────

type UKSection = {
  /** Section number, e.g. "1", "13A" — from <Number> or <Pnumber> */
  sectionNumber: string;
  /** Section heading — from <Title> or <Heading>, empty string if none */
  sectionTitle: string;
  /** Plain text with all tags stripped and whitespace collapsed */
  textContent: string;
  /** false if textContent is empty after stripping */
  hasContent: boolean;
};

type UKLegislation = {
  /** Human-readable title passed in by the caller */
  title: string;
  /** Full URL that was fetched */
  sourceUrl: string;
  /** ISO timestamp of the fetch */
  fetchedAt: string;
  /** All parsed sections in document order */
  sections: UKSection[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ensure a value is always an array, handling single-object parser results. */
function toArray<T>(value: unknown): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

/**
 * Coerce an unknown fast-xml-parser value to a string.
 * Handles both plain strings and the `{ "#text": "..." }` wrapper.
 */
function getStringValue(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("#text" in obj) return String(obj["#text"]);
  }
  return "";
}

/**
 * Recursively extracts all text content from a parsed node.
 * Concatenates #text nodes and descends into all children.
 */
function getAllText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean")
    return String(node);
  if (Array.isArray(node)) return node.map(getAllText).join(" ");
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    // fast-xml-parser emits mixed-content text in the '#text' key
    if ("#text" in obj) return String(obj["#text"]);
    return Object.values(obj).map(getAllText).join(" ");
  }
  return "";
}

/** Strip residual XML/HTML tags and collapse whitespace to a single space. */
function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Recursively walks a parsed XML tree collecting UKSection objects.
 *
 * The walk follows the Legislation Schema conventions:
 *   - P1group bundles a Title with one or more P1 (section) nodes
 *   - P1 carries Pnumber and P1para content
 *   - Section is used by older-format legislation
 *
 * contextTitle is threaded down so a P1group's <Title> is available to its
 * child P1 nodes even though the tree is walked without parent references.
 */
function walkForSections(
  node: unknown,
  contextTitle: string,
  out: UKSection[],
): void {
  if (!node || typeof node !== "object") return;

  // Array — walk each item
  if (Array.isArray(node)) {
    for (const item of node) walkForSections(item, contextTitle, out);
    return;
  }

  const obj = node as Record<string, unknown>;

  // P1group — pick up the group title and thread it into child P1 nodes
  if ("P1group" in obj) {
    const groups = toArray<Record<string, unknown>>(obj["P1group"]);
    for (const group of groups) {
      const groupTitle =
        getStringValue(group["Title"]) ||
        getStringValue(group["Heading"]) ||
        contextTitle;
      // Recurse into the group, carrying its title
      walkForSections(group, groupTitle, out);
    }
    // Continue walking non-P1group siblings
    for (const [k, v] of Object.entries(obj)) {
      if (k !== "P1group") walkForSections(v, contextTitle, out);
    }
    return;
  }

  // P1 — standard section node in current Legislation Schema
  if ("P1" in obj) {
    const p1Nodes = toArray<Record<string, unknown>>(obj["P1"]);
    for (const p1 of p1Nodes) {
      const sectionNumber =
        getStringValue(p1["Pnumber"]) || getStringValue(p1["Number"]) || "";
      const sectionTitle =
        getStringValue(p1["Title"]) ||
        getStringValue(p1["Heading"]) ||
        contextTitle;
      const textContent = cleanText(getAllText(p1["P1para"] ?? p1));
      out.push({ sectionNumber, sectionTitle, textContent, hasContent: textContent.length > 0 });
    }
    // Don't recurse into P1 nodes to avoid double-counting nested structures
  }

  // Section — older / alternate legislation format
  if ("Section" in obj) {
    const sectionNodes = toArray<Record<string, unknown>>(obj["Section"]);
    for (const s of sectionNodes) {
      const sectionNumber =
        getStringValue(s["Number"]) || getStringValue(s["Pnumber"]) || "";
      const sectionTitle =
        getStringValue(s["Title"]) ||
        getStringValue(s["Heading"]) ||
        contextTitle;
      const textContent = cleanText(getAllText(s));
      if (sectionNumber || textContent.length > 10) {
        out.push({ sectionNumber, sectionTitle, textContent, hasContent: textContent.length > 0 });
      }
    }
    // Don't recurse into Section nodes either
  }

  // Recurse into all other keys
  for (const [k, v] of Object.entries(obj)) {
    if (k !== "P1" && k !== "Section" && k !== "P1group") {
      walkForSections(v, contextTitle, out);
    }
  }
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Fetches and parses a single UK statute from legislation.gov.uk.
 *
 * `path` must start with `/`, e.g. `"/ukpga/1996/18/data.xml"`.
 * The XML is parsed with fast-xml-parser and the tree is walked to collect
 * all Section / P1 elements at any depth.
 *
 * @throws if the HTTP request fails or the XML cannot be parsed
 */
export async function fetchUKLegislation(
  path: string,
  title: string,
): Promise<UKLegislation> {
  const url = `${BASE_URL}${path}`;

  // ── 1. Fetch ─────────────────────────────────────────────────────────────────
  let xmlContent: string;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/xml, text/xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; JurisdictIQ/1.0; +https://jurisdictiq.com)",
      },
    });
    if (!res.ok) {
      throw new Error(`fetchUKLegislation(${path}): HTTP ${res.status}`);
    }
    xmlContent = await res.text();
    if (!xmlContent.trimStart().startsWith("<")) {
      throw new Error(
        `fetchUKLegislation(${path}): response is not XML (WAF challenge or empty body)`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("fetchUKLegislation(")) throw err;
    throw new Error(`fetchUKLegislation(${path}): network error: ${msg}`);
  }

  // ── 2. Parse ─────────────────────────────────────────────────────────────────
  let parsed: unknown;
  try {
    const parser = new XMLParser(XML_PARSER_OPTIONS);
    parsed = parser.parse(xmlContent);
  } catch (err) {
    throw new Error(
      `fetchUKLegislation(${path}): parse failed: ${(err as Error).message}`,
    );
  }

  // ── 3. Walk tree for sections ─────────────────────────────────────────────────
  const sections: UKSection[] = [];
  walkForSections(parsed, "", sections);

  return {
    title,
    sourceUrl: url,
    fetchedAt: new Date().toISOString(),
    sections,
  };
}

/**
 * Fetches multiple UK statutes in parallel, returning only successful results.
 *
 * Failed fetches are logged to stderr and excluded from the returned Map.
 * The Map key is the `title` string passed in with each law descriptor.
 * The caller will never receive an exception from this function.
 */
export async function fetchMultipleUKLaws(
  laws: Array<{ path: string; title: string }>,
): Promise<Map<string, UKLegislation>> {
  const results = await Promise.allSettled(
    laws.map(({ path, title }) => fetchUKLegislation(path, title)),
  );

  const lawMap = new Map<string, UKLegislation>();

  results.forEach((result, i) => {
    const { title } = laws[i]!;
    if (result.status === "fulfilled") {
      const leg = result.value;
      console.log(`[GB] Fetched ${title}: ${leg.sections.length} sections`);
      lawMap.set(title, leg);
    } else {
      console.error(`[GB] Failed ${title}: ${result.reason}`);
    }
  });

  return lawMap;
}
