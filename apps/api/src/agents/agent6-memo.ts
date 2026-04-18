import { generateText } from "../lib/claude";
import { SSEStream, emitAgent } from "../lib/sse";
import { Action, Conflict, ExpansionTwin, Obligation, Scenario } from "../types";
import { loadStatuteExcerpts, formatStatuteContext } from "../data/statute-loader";
import { NewsScoutResult } from "../integrations/perplexity-news";

const AGENT = "Agent 6 — Memo Writer";

const SYSTEM_PROMPT = `You are a senior partner at an international law firm writing a client advisory memo. Write in clear, precise legal English. No hedging or filler. Every claim must reference a cited source. Use the citation format: [Jurisdiction — Source Name, Citation Reference].

Structure your memo with these sections:
1. Executive Summary (2 short paragraphs)
2. Conflict Analysis (one subsection per critical/high conflict)
3. Recommended Structure (analysis of the recommended expansion vehicle)
4. Risk Register (table-style: Obligation | Jurisdiction | Severity | Action)
5. 30/60/90-Day Action Plan
6. Recent Regulatory Developments (cite news sources where supplied)
7. Evidence Pack (list of all sources cited)`;

export async function generateMemo(
  twin: ExpansionTwin,
  obligations: Obligation[],
  conflicts: Conflict[],
  scenarios: Scenario[],
  actions: Action[],
  stream: SSEStream,
  recentDevelopments: NewsScoutResult[] = [],
): Promise<{ executiveSummary: string; memoMarkdown: string }> {
  emitAgent(stream, AGENT, "agent_start", "Drafting client advisory memo…");

  const recommended = scenarios.find((s) => s.recommended);
  const criticalConflicts = conflicts.filter((c) => c.severity === "critical" || c.severity === "high");
  const targetObligations = obligations.filter((o) =>
    twin.expansion.targetCountries.includes(o.jurisdiction),
  );

  // Load real statute text for any DE/GB/EU obligations we have raw files for
  const allRelevantObligations = obligations.filter((o) =>
    ["DE", "GB", "EU", ...twin.expansion.targetCountries].includes(o.jurisdiction),
  );
  const statuteExcerpts = loadStatuteExcerpts(allRelevantObligations);
  const statuteContext = formatStatuteContext(statuteExcerpts);

  const userPrompt = `Write a complete client advisory memo for the following expansion.

## MATTER SUMMARY
Company: ${twin.company.name}
Industry: ${twin.company.industry}
HQ: ${twin.company.hqCountry}
Expansion to: ${twin.expansion.targetCountries.join(", ")}
Timeline: ${twin.expansion.timelineDays} days
Data processed: ${twin.data.categories.join(", ")}
Centralised data architecture: ${twin.data.centralised}

## RECOMMENDED STRUCTURE
${recommended?.label ?? "Employer of Record"}
${recommended?.rationale ?? ""}

## CONFLICTS (${conflicts.length} total)
${criticalConflicts.map((c) => `### ${c.severity.toUpperCase()}: ${c.type}
${c.explanation}
Mitigation options: ${c.mitigationOptions.map((m) => m.option).join("; ")}
Blocks expansion: ${c.blocksExpansion}`).join("\n\n")}

## OBLIGATIONS (${targetObligations.length} across target jurisdictions)
${targetObligations.map((o) => `- [${o.jurisdiction}] ${o.title} (${o.severity}) — ${o.source.citation}`).join("\n")}

## ACTION PLAN
${actions.map((a) => `[${a.horizon}] ${a.blocking ? "BLOCKING: " : ""}${a.title} (${a.owner}, ${a.estimatedDays}d)`).join("\n")}
${recentDevelopments.filter((n) => n.isLive && (n.summary || n.highlights.length)).length > 0 ? `
## RECENT REGULATORY DEVELOPMENTS (last 30 days, live news)
${recentDevelopments.filter((n) => n.isLive).map((n) => `### ${n.countryName}
${n.summary}
${n.highlights.map((h) => `- ${h}`).join("\n")}
Sources: ${n.citations.map((c) => `${c.title} (${c.url})`).join("; ") || "n/a"}`).join("\n\n")}
` : ""}
${statuteContext ? `
## PRIMARY SOURCE TEXT (cite directly — these are the authoritative statute provisions)
${statuteContext}
` : ""}
Write the complete memo now. Minimum 800 words. Include at least 5 specific legal citations in the format [Jurisdiction — Law Name, Citation].${statuteExcerpts.length > 0 ? ` You have ${statuteExcerpts.length} primary source excerpt(s) above — quote them directly where relevant rather than paraphrasing.` : ""}${recentDevelopments.some((n) => n.isLive) ? " Include the Recent Regulatory Developments section with date-stamped items and source URLs." : ""}`;

  const memoMarkdown = await generateText(SYSTEM_PROMPT, userPrompt, 4000);

  const lines = memoMarkdown.split("\n");
  const summaryLines: string[] = [];
  let inSummary = false;
  for (const line of lines) {
    if (/executive summary/i.test(line) && /^#+\s/.test(line.trim())) {
      inSummary = true;
      continue;
    }
    if (inSummary && /^#+\s/.test(line.trim())) break;
    if (inSummary) summaryLines.push(line);
  }
  const rawSummary = summaryLines.join("\n").trim();

  // Ensure summary ends on a sentence boundary — if AI output happened to truncate, trim to last period.
  const finalizeSummary = (text: string): string => {
    if (!text) return memoMarkdown.split("\n").slice(0, 6).join("\n").trim();
    const trimmed = text.trim();
    const endsOnPunctuation = /[.!?"'`)\]]\s*$/.test(trimmed);
    if (endsOnPunctuation) return trimmed;
    const lastStop = Math.max(trimmed.lastIndexOf("."), trimmed.lastIndexOf("!"), trimmed.lastIndexOf("?"));
    return lastStop > 0 ? trimmed.slice(0, lastStop + 1) : trimmed;
  };

  const executiveSummary = finalizeSummary(rawSummary);

  emitAgent(stream, AGENT, "memo_ready", "Client advisory memo ready", {
    wordCount: memoMarkdown.split(/\s+/).length,
    statuteSourcesUsed: statuteExcerpts.length,
  });

  return { executiveSummary, memoMarkdown };
}
