import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { SSEStream } from "../lib/sse";
import { sessions, runPipeline, Session } from "../orchestration/pipeline";

export const analysisRouter = Router();

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

  // Start the pipeline
  session.status = "running";
  runPipeline(session.id, session.brief, stream).then(() => {
    stream.close();
  }).catch((err: Error) => {
    stream.emit({ type: "error", agent: "System", message: err.message, timestamp: new Date().toISOString() });
    stream.close();
  });
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
