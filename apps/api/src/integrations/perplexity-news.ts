import fetch from "node-fetch";

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

function buildQuery(iso: string, industry: string): string {
  const name = countryName(iso);
  return `Significant legal, regulatory, tax, employment, data protection, or compliance changes in ${name} affecting foreign companies expanding into the country${industry ? ` (industry context: ${industry})` : ""} in the last 30 days. Focus on enacted laws, official regulator announcements, court rulings, or clear legislative proposals. Provide concise headlines, dates, and the regulator/court issuing each item.`;
}

/**
 * Calls Perplexity Sonar to fetch recent regulatory news for a target jurisdiction.
 * Returns a stub result if PERPLEXITY_API_KEY is not configured (graceful degradation).
 */
export async function fetchTargetCountryNews(
  iso: string,
  industry: string,
): Promise<NewsScoutResult> {
  const name = countryName(iso);
  const apiKey = process.env.PERPLEXITY_API_KEY;
  const retrievedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      isLive: false,
      summary: `Live news scout disabled — set PERPLEXITY_API_KEY to enable real-time regulatory monitoring for ${name}.`,
      highlights: [],
      citations: [],
      retrievedAt,
      countryName: name,
      countryIso: iso,
      reason: "PERPLEXITY_API_KEY not configured",
    };
  }

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You are a legal intelligence analyst. Return concise, factual summaries of recent regulatory developments. Output strict JSON only — no prose, no markdown fences. Schema: {\"summary\": string (2-3 sentences), \"highlights\": string[] (3-5 short bullets, each starting with a date in YYYY-MM-DD if known)}. Cite primary sources where possible.",
          },
          { role: "user", content: buildQuery(iso, industry) },
        ],
        search_recency_filter: "month",
        max_tokens: 700,
        temperature: 0.1,
        return_citations: true,
      }),
    });

    if (!response.ok) {
      return {
        isLive: false,
        summary: `News scout unavailable (HTTP ${response.status}).`,
        highlights: [],
        citations: [],
        retrievedAt,
        countryName: name,
        countryIso: iso,
        reason: `Perplexity API returned ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      citations?: string[];
    };

    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    let summary = "";
    let highlights: string[] = [];

    try {
      const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned) as { summary?: string; highlights?: string[] };
      summary = parsed.summary?.trim() ?? "";
      highlights = (parsed.highlights ?? []).filter((h) => typeof h === "string").slice(0, 5);
    } catch {
      // If model didn't return JSON, take the first line as summary, split rest as highlights.
      const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
      summary = lines[0] ?? "";
      highlights = lines.slice(1, 6).map((l) => l.replace(/^[-•*\d.\s]+/, ""));
    }

    const citationUrls = Array.isArray(data.citations) ? data.citations.slice(0, 5) : [];
    const citations: NewsCitation[] = citationUrls.map((url) => {
      let host = url;
      try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep raw */ }
      return { title: host, url };
    });

    return {
      isLive: true,
      summary: summary || `No standout regulatory developments reported in ${name} in the last 30 days.`,
      highlights,
      citations,
      retrievedAt,
      countryName: name,
      countryIso: iso,
    };
  } catch (err) {
    return {
      isLive: false,
      summary: `News scout error: ${err instanceof Error ? err.message : "unknown error"}`,
      highlights: [],
      citations: [],
      retrievedAt,
      countryName: name,
      countryIso: iso,
      reason: "fetch failed",
    };
  }
}
