import { generateText } from "../lib/claude";
import { SSEStream, emitAgent } from "../lib/sse";
import { Action, Conflict, ExpansionTwin, Obligation, Scenario } from "../types";

const AGENT = "Agent 6 — Memo Writer";

const SYSTEM_PROMPT = `You are a senior partner at an international law firm writing a client advisory memo. Write in clear, precise legal English. No hedging or filler. Every claim must reference a cited source. Use the citation format: [Jurisdiction — Source Name, Citation Reference].

Structure your memo with these sections:
1. Executive Summary (2 short paragraphs)
2. Conflict Analysis (one subsection per critical/high conflict)
3. Recommended Structure (analysis of the recommended expansion vehicle)
4. Risk Register (table-style: Obligation | Jurisdiction | Severity | Action)
5. 30/60/90-Day Action Plan
6. Evidence Pack (list of all sources cited)`;

export async function generateMemo(
  twin: ExpansionTwin,
  obligations: Obligation[],
  conflicts: Conflict[],
  scenarios: Scenario[],
  actions: Action[],
  stream: SSEStream,
): Promise<{ executiveSummary: string; memoMarkdown: string }> {
  emitAgent(stream, AGENT, "agent_start", "Drafting client advisory memo…");

  const recommended = scenarios.find((s) => s.recommended);
  const criticalConflicts = conflicts.filter((c) => c.severity === "critical" || c.severity === "high");
  const targetObligations = obligations.filter((o) =>
    twin.expansion.targetCountries.includes(o.jurisdiction),
  );

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

Write the complete memo now. Minimum 800 words. Include at least 5 specific legal citations in the format [Jurisdiction — Law Name, Citation].`;

  const memoMarkdown = await generateText(SYSTEM_PROMPT, userPrompt, 3000);

  const lines = memoMarkdown.split("\n").filter((l) => l.trim());
  const summaryLines: string[] = [];
  let inSummary = false;
  for (const line of lines) {
    if (line.toLowerCase().includes("executive summary")) { inSummary = true; continue; }
    if (inSummary && line.startsWith("#")) break;
    if (inSummary && line.trim()) summaryLines.push(line.trim());
    if (summaryLines.length >= 4) break;
  }
  const executiveSummary = summaryLines.join(" ").slice(0, 600) || memoMarkdown.slice(0, 400);

  emitAgent(stream, AGENT, "memo_ready", "Client advisory memo ready", {
    wordCount: memoMarkdown.split(/\s+/).length,
  });

  return { executiveSummary, memoMarkdown };
}
