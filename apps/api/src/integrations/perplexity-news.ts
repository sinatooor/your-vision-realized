import { generateText, stripJsonFences } from "../lib/claude";

export interface NewsCitation {
  title: string;
  url: string;
}

export interface NewsScoutResult {
  isLive: boolean;
  summary: string;
  highlights: string[];
  citations: NewsCitation[];
  retrievedAt: string;
  countryName: string;
  countryIso: string;
  reason?: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  DE: "Germany", GB: "United Kingdom", SE: "Sweden", SG: "Singapore", VN: "Vietnam",
  FR: "France", NL: "Netherlands", IE: "Ireland", ES: "Spain", IT: "Italy",
  US: "United States", CA: "Canada", AU: "Australia", JP: "Japan", IN: "India",
  CH: "Switzerland", AE: "United Arab Emirates", BR: "Brazil", MX: "Mexico",
  PL: "Poland", DK: "Denmark", FI: "Finland", NO: "Norway", BE: "Belgium",
  AT: "Austria", PT: "Portugal", CZ: "Czech Republic", HU: "Hungary",
};

function countryName(iso: string): string {
  return COUNTRY_NAMES[iso] ?? iso;
}

const SYSTEM_PROMPT = `You are a legal intelligence analyst specialising in cross-border regulatory compliance. Summarise the key legal, tax, employment, data-protection, and licensing obligations that foreign companies face when expanding into a given jurisdiction. Focus on current regulatory reality — enacted laws, key thresholds, and enforcement posture. Return ONLY strict JSON, no markdown fences, no prose outside the JSON.

Schema:
{
  "summary": string,   // 2-3 sentence overview of the regulatory landscape
  "highlights": string[]  // 4-6 short bullets, each ≤ 20 words, covering distinct obligation areas
}`;

export async function fetchTargetCountryNews(
  iso: string,
  industry: string,
): Promise<NewsScoutResult> {
  const name = countryName(iso);
  const retrievedAt = new Date().toISOString();

  const userPrompt = `Jurisdiction: ${name} (${iso})
Industry context: ${industry || "technology / software"}

Summarise the key compliance obligations and regulatory risks for a foreign company expanding into ${name}. Cover employment law, data protection, tax registration, corporate setup, and any sector-specific licensing relevant to the industry.`;

  try {
    const raw = await generateText(SYSTEM_PROMPT, userPrompt, 600);
    const cleaned = stripJsonFences(raw);

    let summary = "";
    let highlights: string[] = [];

    try {
      const parsed = JSON.parse(cleaned) as { summary?: string; highlights?: string[] };
      summary = parsed.summary?.trim() ?? "";
      highlights = (parsed.highlights ?? []).filter((h) => typeof h === "string").slice(0, 6);
    } catch {
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      summary = lines[0] ?? "";
      highlights = lines.slice(1, 7).map((l) => l.replace(/^[-•*\d.\s]+/, ""));
    }

    return {
      isLive: false,
      summary: summary || `Regulatory overview for ${name} could not be generated.`,
      highlights,
      citations: [],
      retrievedAt,
      countryName: name,
      countryIso: iso,
    };
  } catch (err) {
    return {
      isLive: false,
      summary: `Regulatory scout unavailable for ${name}.`,
      highlights: [],
      citations: [],
      retrievedAt,
      countryName: name,
      countryIso: iso,
      reason: err instanceof Error ? err.message : "unknown error",
    };
  }
}
