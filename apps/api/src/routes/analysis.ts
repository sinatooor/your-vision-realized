import { Router, Request, Response } from "express";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { SSEStream } from "../lib/sse";
import { sessions, runPipeline, Session, MemoChatTurn } from "../orchestration/pipeline";
import { runMemoChat } from "../agents/agent7-memo-chat";
import { AgentEvent, AnalysisResult, ExpansionTwin } from "../types";

export const analysisRouter = Router();

// ---------------------------------------------------------------------------
// Demo helpers
// ---------------------------------------------------------------------------

interface DemoPayload {
  twin: ExpansionTwin;
  result: AnalysisResult;
}

function loadDemoPayload(): DemoPayload | null {
  const p = join(__dirname, "../data/demo-germany.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as DemoPayload;
}

const DEMO_SCRIPT: Array<{ ms: number; event: Omit<AgentEvent, "timestamp"> }> = [
  { ms: 0,    event: { type: "agent_start",       agent: "Agent 1 — Intake",             message: "Parsing mandate brief…" } },
  { ms: 700,  event: { type: "agent_complete",    agent: "Agent 1 — Intake",             message: "Expansion twin extracted — Lovable (GPT Engineer AB) → DE (first entry)" } },
  { ms: 1100, event: { type: "agent_start",       agent: "Agent 2 — Jurisdiction Scout", message: "Scouting DE regulatory landscape…" } },
  { ms: 1600, event: { type: "api_call",          agent: "Agent 2 — Jurisdiction Scout", message: "Loading DE rule pack" } },
  { ms: 2000, event: { type: "api_result",        agent: "Agent 2 — Jurisdiction Scout", message: "9 base obligations loaded" } },
  { ms: 2300, event: { type: "api_call",          agent: "Agent 2 — Jurisdiction Scout", message: "Enriching GDPR Art. 44 obligations via EUR-Lex" } },
  { ms: 2900, event: { type: "api_result",        agent: "Agent 2 — Jurisdiction Scout", message: "GDPR Art. 44-46 (Schrems II) enriched" } },
  { ms: 3200, event: { type: "api_call",          agent: "Agent 2 — Jurisdiction Scout", message: "Enriching EU AI Act obligations via EUR-Lex" } },
  { ms: 3700, event: { type: "api_result",        agent: "Agent 2 — Jurisdiction Scout", message: "EU AI Act Art. 13, 16, 26, 50 enriched" } },
  { ms: 4000, event: { type: "api_call",          agent: "Agent 2 — Jurisdiction Scout", message: "Screening entity via OpenSanctions" } },
  { ms: 4400, event: { type: "api_result",        agent: "Agent 2 — Jurisdiction Scout", message: "No sanctions matches found" } },
  { ms: 4600, event: { type: "api_call",          agent: "Agent 2 — Jurisdiction Scout", message: "Fetching recent regulatory developments (Perplexity)" } },
  { ms: 5200, event: { type: "api_result",        agent: "Agent 2 — Jurisdiction Scout", message: "BAG 2024 ruling on AI monitoring tools retrieved" } },
  { ms: 5400, event: { type: "agent_complete",    agent: "Agent 2 — Jurisdiction Scout", message: "Scouted DE — 9 obligations identified" } },
  { ms: 5700, event: { type: "agent_start",       agent: "Agent 3 — Conflict Engine",    message: "Detecting cross-jurisdiction conflicts…" } },
  { ms: 6100, event: { type: "conflict_detected", agent: "Agent 3 — Conflict Engine",    message: "GDPR Art. 44 violation: LLM API routes EU data to Anthropic US servers without SCCs" } },
  { ms: 6500, event: { type: "conflict_detected", agent: "Agent 3 — Conflict Engine",    message: "BetrVG §87(1)(6): Works Council must approve Lovable's own product before internal use" } },
  { ms: 6900, event: { type: "conflict_detected", agent: "Agent 3 — Conflict Engine",    message: "PE risk: EOR structure does not eliminate dependent agent exposure" } },
  { ms: 7200, event: { type: "agent_complete",    agent: "Agent 3 — Conflict Engine",    message: "4 conflicts identified, 0 block expansion" } },
  { ms: 7500, event: { type: "agent_start",       agent: "Agent 4 — Scenario Simulator", message: "Evaluating entry-model scenarios…" } },
  { ms: 7900, event: { type: "scenario_scored",   agent: "Agent 4 — Scenario Simulator", message: "EOR model scored 141 — recommended" } },
  { ms: 8200, event: { type: "scenario_scored",   agent: "Agent 4 — Scenario Simulator", message: "Contractor-first scored 157 — Scheinselbstaendigkeit risk too high" } },
  { ms: 8500, event: { type: "scenario_scored",   agent: "Agent 4 — Scenario Simulator", message: "GmbH subsidiary scored 184 — Q3 2025 timeline incompatible" } },
  { ms: 8700, event: { type: "agent_complete",    agent: "Agent 4 — Scenario Simulator", message: "EOR recommended — fastest compliant path (35 days to first hire)" } },
  { ms: 8900, event: { type: "agent_start",       agent: "Agent 5 — Resolution Planner", message: "Drafting 90-day compliance action plan…" } },
  { ms: 9400, event: { type: "agent_complete",    agent: "Agent 5 — Resolution Planner", message: "14 actions planned across 0-30 / 31-60 / 61-90 day horizons" } },
  { ms: 9600, event: { type: "agent_start",       agent: "Agent 6 — Memo Writer",        message: "Generating legal memorandum…" } },
  { ms: 9800, event: { type: "memo_ready",        agent: "Agent 6 — Memo Writer",        message: "Memorandum complete" } },
  { ms: 9900, event: { type: "agent_complete",    agent: "Agent 6 — Memo Writer",        message: "Memo ready — analysis complete" } },
];

async function replayDemoStream(stream: SSEStream): Promise<void> {
  let prev = 0;
  for (const { ms, event } of DEMO_SCRIPT) {
    await new Promise<void>((r) => setTimeout(r, ms - prev));
    prev = ms;
    stream.emit({ ...event, timestamp: new Date().toISOString() });
  }
  // brief pause before [DONE]
  await new Promise<void>((r) => setTimeout(r, 200));
}

// POST /api/analysis/start
analysisRouter.post("/start", (req: Request, res: Response) => {
  const { brief } = req.body as { brief?: string };
  if (!brief || typeof brief !== "string" || brief.trim().length < 10) {
    res.status(400).json({ error: "brief is required (min 10 chars)" });
    return;
  }

  const sessionId = uuidv4();
  const session: Session = {
    id: sessionId,
    status: "pending",
    brief: brief.trim(),
    twin: null,
    twinConfirmed: false,
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    stream: null,
    memoChat: [],
    memoSignOff: null,
    supportingDocuments: [],
  };
  sessions.set(sessionId, session);

  res.status(202).json({ sessionId });
});

// GET /api/analysis/:sessionId/stream
analysisRouter.get("/:sessionId/stream", (req: Request, res: Response) => {
  const session = sessions.get(req.params["sessionId"] as string);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const stream = new SSEStream(res);
  session.stream = stream;

  if (session.status === "complete" && session.result) {
    stream.close();
    return;
  }

  if (session.status === "error") {
    stream.emit({ type: "error", agent: "System", message: session.error ?? "Unknown error", timestamp: new Date().toISOString() });
    stream.close();
    return;
  }

  session.status = "running";

  if (session.isDemoSession) {
    // Replay cached events over ~10 seconds then close
    replayDemoStream(stream).then(() => {
      session.status = "complete";
      stream.close();
    }).catch((err: Error) => {
      stream.emit({ type: "error", agent: "System", message: err.message, timestamp: new Date().toISOString() });
      stream.close();
    });
    return;
  }

  // Start the real AI pipeline
  runPipeline(session.id, session.brief, stream).then(() => {
    stream.close();
  }).catch((err: Error) => {
    stream.emit({ type: "error", agent: "System", message: err.message, timestamp: new Date().toISOString() });
    stream.close();
  });
});

// POST /api/analysis/demo — create a demo session backed by cached Germany data
analysisRouter.post("/demo", (req: Request, res: Response) => {
  const payload = loadDemoPayload();
  if (!payload) {
    res.status(503).json({ error: "Demo data not seeded yet — run `npm run seed:demo` in apps/api/" });
    return;
  }

  const sessionId = uuidv4();
  const session: Session = {
    id: sessionId,
    status: "pending",
    brief: payload.twin.rawBrief,
    twin: payload.twin,
    twinConfirmed: true,
    result: payload.result,
    error: null,
    createdAt: new Date().toISOString(),
    stream: null,
    memoChat: [],
    memoSignOff: null,
    supportingDocuments: [],
    isDemoSession: true,
  };
  sessions.set(sessionId, session);

  res.status(202).json({ sessionId });
});

// GET /api/analysis/:sessionId/twin
analysisRouter.get("/:sessionId/twin", (req: Request, res: Response) => {
  const session = sessions.get(req.params["sessionId"] as string);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ twin: session.twin, confirmed: session.twinConfirmed });
});

// PATCH /api/analysis/:sessionId/twin
analysisRouter.patch("/:sessionId/twin", (req: Request, res: Response) => {
  const session = sessions.get(req.params["sessionId"] as string);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { twin } = req.body as { twin?: unknown };
  if (twin) {
    session.twin = twin as Session["twin"];
  }
  session.twinConfirmed = true;

  if (session.continueFromScout) {
    session.continueFromScout();
    delete session.continueFromScout;
  }

  res.json({ ok: true });
});

// GET /api/analysis/:sessionId/result
analysisRouter.get("/:sessionId/result", (req: Request, res: Response) => {
  const session = sessions.get(req.params["sessionId"] as string);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.status === "error") {
    res.status(500).json({ error: session.error });
    return;
  }

  if (!session.result) {
    res.status(202).json({ status: session.status, message: "Analysis still running" });
    return;
  }

  res.json(session.result);
});

// GET /api/analysis/:sessionId/memo
analysisRouter.get("/:sessionId/memo", (req: Request, res: Response) => {
  const session = sessions.get(req.params["sessionId"] as string);
  if (!session?.result) {
    res.status(404).json({ error: "Memo not ready" });
    return;
  }
  res.json({
    markdown: session.result.memoMarkdown,
    executiveSummary: session.result.executiveSummary,
  });
});

// GET /api/analysis/:sessionId/memo-chat — fetch chat history + sign-off state
analysisRouter.get("/:sessionId/memo-chat", (req: Request, res: Response) => {
  const session = sessions.get(req.params["sessionId"] as string);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({
    history: session.memoChat,
    signOff: session.memoSignOff,
    documents: session.supportingDocuments.map(({ id, name, size, uploadedAt }) => ({
      id,
      name,
      size,
      uploadedAt,
    })),
  });
});

// POST /api/analysis/:sessionId/memo-chat — lawyer sends instruction to AI
analysisRouter.post("/:sessionId/memo-chat", async (req: Request, res: Response) => {
  const session = sessions.get(req.params["sessionId"] as string);
  if (!session?.result) {
    res.status(404).json({ error: "Memo not ready for chat" });
    return;
  }

  const { message } = req.body as { message?: string };
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const userTurn: MemoChatTurn = {
    role: "user",
    content: message.trim(),
    timestamp: new Date().toISOString(),
  };
  session.memoChat.push(userTurn);

  try {
    const chatResult = await runMemoChat(
      session.result.memoMarkdown,
      message.trim(),
      session.memoChat.slice(0, -1),
      session.supportingDocuments,
    );

    session.result.memoMarkdown = chatResult.updatedMemoMarkdown;
    session.result.executiveSummary =
      chatResult.updatedExecutiveSummary || session.result.executiveSummary;

    const assistantTurn: MemoChatTurn = {
      role: "assistant",
      content: chatResult.reply,
      timestamp: new Date().toISOString(),
    };
    session.memoChat.push(assistantTurn);

    res.json({
      reply: chatResult.reply,
      memoMarkdown: chatResult.updatedMemoMarkdown,
      executiveSummary: session.result.executiveSummary,
      history: session.memoChat,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Memo chat failed";
    // Remove the user turn we speculatively pushed, so the client can retry cleanly.
    session.memoChat.pop();
    res.status(500).json({ error: msg });
  }
});

// POST /api/analysis/:sessionId/sign-off — lawyer digital sign-off
analysisRouter.post("/:sessionId/sign-off", (req: Request, res: Response) => {
  const session = sessions.get(req.params["sessionId"] as string);
  if (!session?.result) {
    res.status(404).json({ error: "Memo not ready to sign" });
    return;
  }

  const { lawyerName, signatureDataUrl } = req.body as {
    lawyerName?: string;
    signatureDataUrl?: string;
  };

  if (!lawyerName || typeof lawyerName !== "string" || lawyerName.trim().length === 0) {
    res.status(400).json({ error: "lawyerName is required" });
    return;
  }

  session.memoSignOff = {
    lawyerName: lawyerName.trim(),
    signedAt: new Date().toISOString(),
    signatureDataUrl:
      typeof signatureDataUrl === "string" && signatureDataUrl.startsWith("data:image/")
        ? signatureDataUrl
        : undefined,
  };

  res.json({ signOff: session.memoSignOff });
});

// DELETE /api/analysis/:sessionId/sign-off — revoke sign-off
analysisRouter.delete("/:sessionId/sign-off", (req: Request, res: Response) => {
  const session = sessions.get(req.params["sessionId"] as string);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  session.memoSignOff = null;
  res.json({ ok: true });
});

// POST /api/analysis/:sessionId/documents — register a supporting document
// (Simple JSON payload; the frontend reads text client-side and ships the excerpt.)
analysisRouter.post("/:sessionId/documents", (req: Request, res: Response) => {
  const session = sessions.get(req.params["sessionId"] as string);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { name, size, textExcerpt } = req.body as {
    name?: string;
    size?: number;
    textExcerpt?: string;
  };

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const doc = {
    id: uuidv4(),
    name: name.slice(0, 200),
    size: typeof size === "number" ? size : 0,
    uploadedAt: new Date().toISOString(),
    textExcerpt:
      typeof textExcerpt === "string" ? textExcerpt.slice(0, 20000) : undefined,
  };
  session.supportingDocuments.push(doc);

  res.json({ document: { id: doc.id, name: doc.name, size: doc.size, uploadedAt: doc.uploadedAt } });
});

// DELETE /api/analysis/:sessionId/documents/:docId
analysisRouter.delete("/:sessionId/documents/:docId", (req: Request, res: Response) => {
  const session = sessions.get(req.params["sessionId"] as string);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const docId = req.params["docId"];
  session.supportingDocuments = session.supportingDocuments.filter((d) => d.id !== docId);
  res.json({ ok: true });
});

// GET /api/analysis/demo — pre-run demo session
analysisRouter.get("/demo", (_req: Request, res: Response) => {
  const demoResult = buildDemoResult();
  res.json(demoResult);
});

function buildDemoResult() {
  return {
    id: "demo-001",
    twinId: "demo-twin-001",
    createdAt: new Date().toISOString(),
    obligations: [
      { id: "DE-001", jurisdiction: "DE", category: "tax", title: "Permanent Establishment Risk", description: "Sustained business activity creates PE risk.", trigger: "First employee", threshold: null, severity: "critical", source: { citation: "§ 12 AO", url: "", retrievedAt: new Date().toISOString(), isLive: false }, confidence: 0.95, requiresLocalCounsel: true },
      { id: "DE-002", jurisdiction: "DE", category: "employment", title: "Works Council Formation Right", description: "5+ employees triggers Betriebsrat right.", trigger: "5th employee", threshold: "5 employees", severity: "high", source: { citation: "BetrVG § 1", url: "", retrievedAt: new Date().toISOString(), isLive: false }, confidence: 0.98, requiresLocalCounsel: false },
      { id: "VN-001", jurisdiction: "VN", category: "data", title: "Data Localisation — Cybersecurity Law", description: "Vietnamese user data must be stored in Vietnam.", trigger: "Storing VN user data", threshold: null, severity: "critical", source: { citation: "Cybersecurity Law 2018, Art. 26", url: "", retrievedAt: new Date().toISOString(), isLive: false }, confidence: 0.92, requiresLocalCounsel: true },
    ],
    conflicts: [
      { id: "conf-demo-001", obligationAId: "DE-001", obligationBId: "VN-001", type: "conflict", explanation: "GDPR centralised storage conflicts with Vietnam data localisation requirements.", impactedTwinFields: ["data.centralised"], mitigationOptions: [{ option: "Data segregation", description: "Separate EU and VN data stores.", operationalImpact: "medium" }], severity: "critical", blocksExpansion: true },
    ],
    scenarios: [
      { id: "s1", model: "contractor-first", label: "Contractor-First", description: "Engage contractors initially.", assumptions: [], obligationsTriggered: [], conflictsResolved: [], conflictsRemaining: ["conf-demo-001"], score: { legalRisk: 25, complianceBurden: 20, timeToLaunchDays: 7, operationalComplexity: 20, confidencePenalty: 0, total: 18.9 }, recommended: true, rationale: "Lowest risk entry point given architectural conflict." },
    ],
    actions: [
      { id: "a1", title: "Implement data segregation architecture", description: "Separate EU and VN data stores.", owner: "partner", horizon: "0-30", estimatedDays: 10, dependsOn: [], obligationId: "VN-001", blocking: true },
    ],
    recommendedScenario: "contractor-first",
    executiveSummary: "This analysis identifies a critical data architecture conflict between GDPR and Vietnam's Cybersecurity Law. Immediate action is required before market entry.",
    memoMarkdown: "# JurisdictIQ Advisory Memo\n\n## Executive Summary\n\nThis memo addresses the expansion of a Swedish HR SaaS company into Germany and Vietnam. A critical conflict exists between GDPR centralised data requirements and Vietnam's Cybersecurity Law data localisation mandate.\n\n## Conflict Analysis\n\n### CRITICAL: GDPR vs Vietnam Data Localisation\n\nThe EU's GDPR [DE — GDPR, CELEX: 32016R0679] requires personal data of EU residents to remain within the EEA. Vietnam's Cybersecurity Law [VN — Law on Cybersecurity 2018, Art. 26] mandates that important data about Vietnamese citizens be stored on servers physically located in Vietnam. A centralised architecture cannot satisfy both simultaneously.\n\n**Mitigation:** Implement data segregation architecture before Vietnam launch.\n\n## Recommended Structure\n\nThe **Contractor-First** model is recommended as it minimises initial exposure while data architecture is resolved.\n\n## Risk Register\n\n| Obligation | Jurisdiction | Severity | Action |\n|---|---|---|---|\n| PE Risk | DE | Critical | Monitor headcount |\n| Data Localisation | VN | Critical | Segregate data stores |\n| Works Council | DE | High | Plan HR processes |\n\n## 30/60/90-Day Action Plan\n\n**Days 0–30 (Blocking)**\n- Implement data segregation architecture (Partner, 10 days)\n\n## Evidence Pack\n\n- [DE — Abgabenordnung, § 12 AO]\n- [DE — BetrVG, § 1]\n- [VN — Law on Cybersecurity 2018, Art. 26]\n- [DE — GDPR, CELEX: 32016R0679]\n",
  };
}
