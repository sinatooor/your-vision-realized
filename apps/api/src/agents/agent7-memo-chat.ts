import { generateText } from "../lib/claude";
import { MemoChatTurn, SupportingDocument } from "../orchestration/pipeline";

const SYSTEM_PROMPT = `You are a senior partner at an international law firm helping a colleague refine a client advisory memo. The colleague types instructions; you (a) reply briefly acknowledging the change and (b) produce the full updated memo markdown.

Rules:
- The memo MUST remain a complete, client-grade legal memorandum — always keep sections: Executive Summary, Conflict Analysis, Recommended Structure, Risk Register, 30/60/90-Day Action Plan, Evidence Pack.
- Preserve citations in the format [Jurisdiction — Source Name, Citation Reference]. Never remove or fabricate citations.
- When the user asks for a change, apply it precisely. Do not silently rewrite unrelated sections.
- Keep the tone formal, precise, non-hedging.

Output format — respond with EXACTLY this XML structure and nothing else:

<reply>One to three sentences acknowledging what you changed and why.</reply>
<memo>
# JurisdictIQ Advisory Memorandum
...full updated memo markdown...
</memo>`;

export interface MemoChatResult {
  reply: string;
  updatedMemoMarkdown: string;
  updatedExecutiveSummary: string;
}

function buildChatContext(history: MemoChatTurn[]): string {
  if (history.length === 0) return "";
  const recent = history.slice(-6);
  return recent
    .map((t) => `[${t.role.toUpperCase()}] ${t.content}`)
    .join("\n\n");
}

function buildAttachmentContext(docs: SupportingDocument[]): string {
  if (docs.length === 0) return "";
  return docs
    .map((d) =>
      d.textExcerpt
        ? `--- ${d.name} ---\n${d.textExcerpt.slice(0, 4000)}`
        : `--- ${d.name} (binary, no text extracted) ---`,
    )
    .join("\n\n");
}

function parseResponse(text: string, fallbackMemo: string): MemoChatResult {
  const replyMatch = text.match(/<reply>([\s\S]*?)<\/reply>/i);
  const memoMatch = text.match(/<memo>([\s\S]*?)<\/memo>/i);

  const reply = replyMatch?.[1]?.trim() ?? "Applied the requested change.";
  const memo = memoMatch?.[1]?.trim() ?? fallbackMemo;

  // Extract new executive summary from the updated memo.
  const lines = memo.split("\n");
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
  const endsOnPunctuation = /[.!?"'`)\]]\s*$/.test(rawSummary);
  const lastStop = Math.max(
    rawSummary.lastIndexOf("."),
    rawSummary.lastIndexOf("!"),
    rawSummary.lastIndexOf("?"),
  );
  const updatedExecutiveSummary = endsOnPunctuation || lastStop < 0
    ? rawSummary
    : rawSummary.slice(0, lastStop + 1);

  return {
    reply,
    updatedMemoMarkdown: memo,
    updatedExecutiveSummary: updatedExecutiveSummary || rawSummary,
  };
}

export async function runMemoChat(
  currentMemoMarkdown: string,
  userMessage: string,
  history: MemoChatTurn[],
  attachments: SupportingDocument[],
): Promise<MemoChatResult> {
  const chatContext = buildChatContext(history);
  const attachmentContext = buildAttachmentContext(attachments);
  const today = new Date();
  const todayHuman = today.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const todayIso = today.toISOString().slice(0, 10);

  const userPrompt = `## TODAY'S DATE
${todayHuman} (${todayIso}). If the memo references a current/"as of" date, use this. Never invent a different date.

## CURRENT MEMO (the source of truth — edit THIS)

${currentMemoMarkdown}
${attachmentContext ? `\n## SUPPORTING DOCUMENTS (context only — do not copy verbatim unless directly relevant)\n\n${attachmentContext}\n` : ""}
${chatContext ? `\n## PRIOR CONVERSATION\n\n${chatContext}\n` : ""}
## NEW INSTRUCTION FROM LAWYER

${userMessage}

Now return <reply> and <memo> per the system format. The <memo> section MUST contain the full updated memo markdown.`;

  const raw = await generateText(SYSTEM_PROMPT, userPrompt, 6000);
  return parseResponse(raw, currentMemoMarkdown);
}
