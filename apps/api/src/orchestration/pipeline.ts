import { v4 as uuidv4 } from "uuid";
import { SSEStream } from "../lib/sse";
import { extractExpansionTwin } from "../agents/agent1-intake";
import { scoutJurisdictions } from "../agents/agent2-scout";
import { detectConflicts } from "../agents/agent3-conflicts";
import { simulateScenarios } from "../agents/agent4-scenarios";
import { planResolution } from "../agents/agent5-planner";
import { generateMemo } from "../agents/agent6-memo";
import { AnalysisResult, ExpansionTwin } from "../types";

export interface Session {
  id: string;
  status: "pending" | "awaiting_twin" | "running" | "complete" | "error";
  brief: string;
  twin: ExpansionTwin | null;
  twinConfirmed: boolean;
  result: AnalysisResult | null;
  error: string | null;
  createdAt: string;
  stream: SSEStream | null;
  continueFromScout?: () => void;
}

export const sessions = new Map<string, Session>();

// Clean up sessions older than 2 hours
setInterval(() => {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, session] of sessions) {
    if (new Date(session.createdAt).getTime() < twoHoursAgo) {
      sessions.delete(id);
    }
  }
}, 15 * 60 * 1000);

export async function runPipeline(
  sessionId: string,
  brief: string,
  stream: SSEStream,
): Promise<AnalysisResult> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  try {
    // Agent 1 — Intake
    const twin = await extractExpansionTwin(brief, stream);
    session.twin = twin;
    session.status = "awaiting_twin";

    // Human checkpoint: wait for twin confirmation
    await waitForTwinConfirmation(session);

    session.status = "running";
    const confirmedTwin = session.twin!;

    // Agent 2 — Scout (parallel jurisdiction retrieval)
    const obligations = await scoutJurisdictions(confirmedTwin, stream);

    // Agent 3 — Conflict Engine (deterministic)
    const conflicts = await detectConflicts(confirmedTwin, obligations, stream);

    // Agent 4 — Scenario Simulator
    const scenarios = await simulateScenarios(confirmedTwin, obligations, conflicts, stream);
    const recommended = scenarios.find((s) => s.recommended) ?? scenarios[0];

    // Agent 5 — Resolution Planner
    const actions = await planResolution(confirmedTwin, recommended, conflicts, obligations, stream);

    // Agent 6 — Memo Writer
    const { executiveSummary, memoMarkdown } = await generateMemo(
      confirmedTwin,
      obligations,
      conflicts,
      scenarios,
      actions,
      stream,
    );

    const result: AnalysisResult = {
      id: uuidv4(),
      twinId: confirmedTwin.id,
      createdAt: new Date().toISOString(),
      obligations,
      conflicts,
      scenarios,
      actions,
      recommendedScenario: recommended.model,
      executiveSummary,
      memoMarkdown,
    };

    session.result = result;
    session.status = "complete";
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pipeline error";
    session.status = "error";
    session.error = message;
    throw err;
  }
}

function waitForTwinConfirmation(session: Session): Promise<void> {
  return new Promise((resolve) => {
    if (session.twinConfirmed) {
      resolve();
      return;
    }
    session.continueFromScout = resolve;
    // Auto-confirm after 60 seconds if no human input
    setTimeout(() => {
      session.twinConfirmed = true;
      resolve();
    }, 60000);
  });
}
