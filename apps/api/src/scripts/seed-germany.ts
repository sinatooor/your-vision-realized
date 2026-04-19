/**
 * Headless seed script — runs the full analysis pipeline for Germany and
 * saves the result to src/data/demo-germany.json.
 *
 * Run with:  npm run seed:demo   (from apps/api/)
 */
import dotenv from "dotenv";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

// Load .env before importing any module that reads env vars
dotenv.config({ path: join(__dirname, "../../.env") });

// eslint-disable-next-line import/first
import { SSEStream } from "../lib/sse";
import { sessions, runPipeline, Session } from "../orchestration/pipeline";
import { AgentEvent } from "../types";

// ---------------------------------------------------------------------------
// Null SSE stream — captures nothing, just logs to console
// ---------------------------------------------------------------------------
class ConsoleSSEStream {
  emit(event: AgentEvent): void {
    const prefix = event.type === "agent_start" ? "▶" : event.type === "agent_complete" ? "✓" : " ";
    console.log(`  ${prefix} [${event.agent}] ${event.message}`);
  }
  close(): void {
    /* no-op */
  }
}

// ---------------------------------------------------------------------------
// Germany brief — realistic demo scenario for NordHR Technologies AB
// ---------------------------------------------------------------------------
const GERMANY_BRIEF = [
  "NordHR Technologies AB is an HR SaaS company headquartered in Sweden (SE) with approximately",
  "50 employees globally and annual revenue of €5M–€10M. They are expanding to Germany (DE) and",
  "plan to hire 8 employees on a hybrid basis using an Employer of Record (EOR) structure.",
  "They process HR data (employee records, payroll, performance data) and customer data.",
  "Their data architecture is centralised in Sweden. Target launch: Q3 2025.",
  "Current international presence — DE: 3 (EOR), SG: 1 (contractor), GB: 2 (EOR).",
  "Their product includes AI/ML features subject to AI Act obligations.",
].join(" ");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log("🚀  Seeding Germany demo analysis…");
  console.log("    Brief:", GERMANY_BRIEF.slice(0, 80) + "…\n");

  const sessionId = uuidv4();
  const stream = new ConsoleSSEStream() as unknown as SSEStream;

  const session: Session = {
    id: sessionId,
    status: "pending",
    brief: GERMANY_BRIEF,
    twin: null,
    // Pre-confirm the twin so the pipeline does not pause waiting for human input
    twinConfirmed: true,
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    stream: null,
    memoChat: [],
    memoSignOff: null,
    supportingDocuments: [],
  };
  sessions.set(sessionId, session);

  try {
    const result = await runPipeline(sessionId, GERMANY_BRIEF, stream);

    const outDir = join(__dirname, "../data");
    mkdirSync(outDir, { recursive: true });

    const payload = { twin: session.twin, result };
    const outPath = join(outDir, "demo-germany.json");
    writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");

    console.log(`\n✅  Saved → ${outPath}`);
    console.log(`    Obligations : ${result.obligations.length}`);
    console.log(`    Conflicts   : ${result.conflicts.length}`);
    console.log(`    Scenarios   : ${result.scenarios.length}`);
    console.log(`    Actions     : ${result.actions.length}`);
  } catch (err) {
    console.error("\n❌  Seed failed:", err);
    process.exit(1);
  }
}

main().catch(console.error);
