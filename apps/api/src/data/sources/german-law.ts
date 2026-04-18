import fetch from "node-fetch";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";

const BASE_URL = "https://www.gesetze-im-internet.de";

const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: true,
  trimValues: true,
};

// ─── Local types (not exported to packages/types) ────────────────────────────

type GermanNorm = {
  /** Paragraph identifier, e.g. "§ 1" — from <enbez> */
  paragraphId: string;
  /** Paragraph heading — from <titel>, empty string if missing */
  paragraphTitle: string;
  /** Raw XML of the <norm> element as extracted from the source file */
  rawXml: string;
  /** Plain text with all XML/HTML tags stripped and whitespace collapsed */
  textContent: string;
  /** false if textContent is empty after stripping */
  hasContent: boolean;
};

type GermanLaw = {
  /** URL-safe abbreviation used in the gesetze-im-internet path, e.g. "betrvg" */
  abbreviation: string;
  /** Short title from <jurabk> of the first norm, e.g. "BetrVG" */
  shortTitle: string;
  /** Long title from <langue> of the first norm */
  longTitle: string;
  /** The ZIP URL that was fetched */
  sourceUrl: string;
  /** ISO timestamp of when the ZIP was fetched */
  fetchedAt: string;
  /** All parsed norms in document order */
  norms: GermanNorm[];
};

// ─── Parsed XML shape returned by fast-xml-parser ────────────────────────────

interface ParsedNorm {
  metadaten?: {
    jurabk?: string | number;
    langue?: string | number;
    enbez?: string | number;
    titel?: string | number;
  };
  textdaten?: unknown;
}

interface ParsedDocument {
  dokumente?: {
    norm?: ParsedNorm | ParsedNorm[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ensure a value is always an array, normalising single-object results from the XML parser. */
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Strip all XML/HTML tags and collapse whitespace to a single space. */
function stripTags(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Downloads and parses a single German federal law from gesetze-im-internet.de.
 *
 * Fetches `https://www.gesetze-im-internet.de/{abbreviation}/xml.zip`, unzips
 * in memory, parses the largest XML file, and returns a structured GermanLaw
 * object containing all norms.
 *
 * @throws if the HTTP request fails or the XML cannot be parsed
 */
export async function fetchGermanLaw(abbreviation: string): Promise<GermanLaw> {
  const url = `${BASE_URL}/${abbreviation}/xml.zip`;

  // ── 1. Fetch ZIP ────────────────────────────────────────────────────────────
  let buffer: Buffer;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `fetchGermanLaw(${abbreviation}): HTTP ${res.status} from ${url}`,
      );
    }
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Re-throw our own formatted errors unchanged; wrap network errors
    if (msg.startsWith("fetchGermanLaw(")) throw err;
    throw new Error(`fetchGermanLaw(${abbreviation}): network error: ${msg}`);
  }

  // ── 2. Unzip in memory ──────────────────────────────────────────────────────
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch (err) {
    throw new Error(
      `fetchGermanLaw(${abbreviation}): ZIP open failed: ${
        (err as Error).message
      }`,
    );
  }

  const xmlEntries = zip
    .getEntries()
    .filter((e) => e.entryName.endsWith(".xml") && !e.isDirectory);

  if (xmlEntries.length === 0) {
    throw new Error(
      `fetchGermanLaw(${abbreviation}): no XML file found in ZIP`,
    );
  }

  // Pick the largest XML file — the main statute text
  const mainEntry = xmlEntries.reduce((best, e) =>
    e.header.size > best.header.size ? e : best,
  );

  let xmlContent: string;
  try {
    xmlContent = mainEntry.getData().toString("utf-8");
  } catch (err) {
    throw new Error(
      `fetchGermanLaw(${abbreviation}): failed to read XML from ZIP: ${
        (err as Error).message
      }`,
    );
  }

  // ── 3. Extract raw <norm> blocks before parsing (preserves fidelity) ────────
  // Lazy match so each <norm>…</norm> is captured individually
  const normRawXmlBlocks = xmlContent.match(/<norm[\s\S]*?<\/norm>/g) ?? [];

  // ── 4. Parse with fast-xml-parser ──────────────────────────────────────────
  let parsed: ParsedDocument;
  try {
    const parser = new XMLParser(XML_PARSER_OPTIONS);
    parsed = parser.parse(xmlContent) as ParsedDocument;
  } catch (err) {
    throw new Error(
      `fetchGermanLaw(${abbreviation}): XML parse failed: ${
        (err as Error).message
      }`,
    );
  }

  const rawNorms = toArray<ParsedNorm>(
    parsed.dokumente?.norm as ParsedNorm | ParsedNorm[] | undefined,
  );

  // ── 5. Extract title from first norm ────────────────────────────────────────
  const firstMeta = rawNorms[0]?.metadaten ?? {};
  const shortTitle = String(firstMeta.jurabk ?? abbreviation);
  const longTitle = String(firstMeta.langue ?? "");

  // ── 6. Build GermanNorm[] ───────────────────────────────────────────────────
  const norms: GermanNorm[] = rawNorms.map((norm, i) => {
    const meta = norm.metadaten ?? {};
    const paragraphId = String(meta.enbez ?? "");
    const paragraphTitle = String(meta.titel ?? "");
    // rawXml from the regex-extracted block for that index; fall back to empty
    const rawXml = normRawXmlBlocks[i] ?? "";
    const textContent = stripTags(rawXml);

    return {
      paragraphId,
      paragraphTitle,
      rawXml,
      textContent,
      hasContent: textContent.length > 0,
    };
  });

  return {
    abbreviation,
    shortTitle,
    longTitle,
    sourceUrl: url,
    fetchedAt: new Date().toISOString(),
    norms,
  };
}

/**
 * Fetches multiple German laws in parallel, returning only successful results.
 *
 * Failed fetches are logged to stderr and excluded from the returned Map.
 * The caller will never receive an exception from this function.
 */
export async function fetchMultipleGermanLaws(
  abbreviations: string[],
): Promise<Map<string, GermanLaw>> {
  const results = await Promise.allSettled(
    abbreviations.map((abbr) => fetchGermanLaw(abbr)),
  );

  const lawMap = new Map<string, GermanLaw>();

  results.forEach((result, i) => {
    const abbr = abbreviations[i]!;
    if (result.status === "fulfilled") {
      const law = result.value;
      console.log(`[DE] Fetched ${law.shortTitle}: ${law.norms.length} norms`);
      lawMap.set(abbr, law);
    } else {
      console.error(`[DE] Failed ${abbr}: ${result.reason}`);
    }
  });

  return lawMap;
}
