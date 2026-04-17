import { v4 as uuidv4 } from "uuid";
import { extractStructured } from "../lib/claude";
import { SSEStream, emitAgent } from "../lib/sse";
import { Action, ActionOwner, Conflict, ExpansionTwin, Obligation, Scenario } from "../types";

const AGENT = "Agent 5 — Resolution Planner";

const ACTION_SCHEMA = `interface Action {
  id: string;           // leave empty
  title: string;        // short imperative (e.g. "Register for PAYE with HMRC")
  description: string;  // 1-2 sentences explaining what to do and why
  owner: "partner" | "associate" | "local-counsel" | "client";
  horizon: "0-30" | "31-60" | "61-90";  // days from engagement start
  estimatedDays: number;  // working days to complete this action
  dependsOn: string[];    // titles of actions this depends on (use title string)
  obligationId: string;   // ID of the obligation this addresses (can be empty string)
  blocking: boolean;      // true if expansion cannot proceed without this
}`;

export async function planResolution(
  twin: ExpansionTwin,
  recommendedScenario: Scenario,
  conflicts: Conflict[],
  obligations: Obligation[],
  stream: SSEStream,
): Promise<Action[]> {
  emitAgent(stream, AGENT, "agent_start", "Building 30/60/90-day resolution action plan…");

  const criticalAndHigh = conflicts.filter(
    (c) => c.severity === "critical" || c.severity === "high",
  );
  const targetObligations = obligations.filter((o) =>
    twin.expansion.targetCountries.includes(o.jurisdiction),
  );

  const systemPrompt = `You are a senior partner at an international law firm building a client action plan. Return ONLY a valid JSON array of Action objects. No prose, no markdown fences.`;

  const userPrompt = `Build a 30/60/90-day action plan for this expansion.

COMPANY: ${twin.company.name} (${twin.company.industry}, HQ: ${twin.company.hqCountry})
EXPANDING TO: ${twin.expansion.targetCountries.join(", ")}
RECOMMENDED STRUCTURE: ${recommendedScenario.label}
RATIONALE: ${recommendedScenario.rationale}

CRITICAL/HIGH CONFLICTS TO RESOLVE:
${criticalAndHigh.map((c) => `- [${c.severity.toUpperCase()}] ${c.explanation.slice(0, 120)}...
  Mitigation: ${c.mitigationOptions[0]?.option ?? "Seek local counsel"}`).join("\n")}

KEY OBLIGATIONS (target jurisdictions):
${targetObligations.slice(0, 8).map((o) => `- [${o.jurisdiction}][${o.category}] ${o.title} (${o.severity})`).join("\n")}

ACTION SCHEMA:
${ACTION_SCHEMA}

Rules:
- Return 9–12 actions (3–4 per horizon)
- All critical conflict mitigations must appear as blocking actions in 0-30 days
- Entity registration before employment contracts
- DPIA before data processing begins
- EOR engagement before first hire
- Use "local-counsel" owner for jurisdiction-specific legal work
- Use "partner" for strategic decisions
- Use "associate" for documentation and filings
- Use "client" for business decisions`;

  try {
    const raw = await extractStructured<Action[]>(systemPrompt, userPrompt, ACTION_SCHEMA);
    const actions = (Array.isArray(raw) ? raw : []).map((a) => ({
      ...a,
      id: uuidv4(),
      obligationId: a.obligationId || (targetObligations[0]?.id ?? ""),
    }));

    const byCounts = ["0-30", "31-60", "61-90"].reduce<Record<string, number>>((acc, h) => {
      acc[h] = actions.filter((a) => a.horizon === h).length;
      return acc;
    }, {});

    emitAgent(stream, AGENT, "agent_complete", `Action plan ready — ${actions.length} actions across 3 horizons`, {
      total: actions.length,
      byHorizon: byCounts,
      blocking: actions.filter((a) => a.blocking).length,
    });

    actions.sort((a, b) => {
      const hOrder: Record<string, number> = { "0-30": 0, "31-60": 1, "61-90": 2 };
      const hDiff = (hOrder[a.horizon] ?? 0) - (hOrder[b.horizon] ?? 0);
      if (hDiff !== 0) return hDiff;
      return a.blocking === b.blocking ? 0 : a.blocking ? -1 : 1;
    });

    return actions;
  } catch {
    return buildFallbackPlan(twin, recommendedScenario, conflicts, targetObligations);
  }
}

function buildFallbackPlan(
  twin: ExpansionTwin,
  scenario: Scenario,
  conflicts: Conflict[],
  obligations: Obligation[],
): Action[] {
  const actions: Action[] = [];
  const targets = twin.expansion.targetCountries;

  const ownerFor = (category: string): ActionOwner => {
    if (category === "tax") return "associate";
    if (category === "employment") return "local-counsel";
    if (category === "data") return "associate";
    if (category === "corporate") return "local-counsel";
    return "associate";
  };

  for (const c of conflicts.filter((x) => x.severity === "critical" || x.severity === "high").slice(0, 3)) {
    actions.push({
      id: uuidv4(),
      title: c.mitigationOptions[0]?.option ?? "Address conflict",
      description: c.mitigationOptions[0]?.description ?? c.explanation.slice(0, 100),
      owner: "partner",
      horizon: "0-30",
      estimatedDays: 5,
      dependsOn: [],
      obligationId: c.obligationAId,
      blocking: c.blocksExpansion,
    });
  }

  for (const o of obligations.filter((x) => x.severity === "high").slice(0, 3)) {
    actions.push({
      id: uuidv4(),
      title: `Comply with: ${o.title}`,
      description: o.description.slice(0, 150),
      owner: ownerFor(o.category),
      horizon: "0-30",
      estimatedDays: 3,
      dependsOn: [],
      obligationId: o.id,
      blocking: o.severity === "critical",
    });
  }

  for (const country of targets.slice(0, 2)) {
    actions.push({
      id: uuidv4(),
      title: `Register ${scenario.model === "subsidiary" ? "subsidiary entity" : "EOR agreement"} in ${country}`,
      description: `Establish the ${scenario.label} structure in ${country} as the recommended expansion vehicle.`,
      owner: "local-counsel",
      horizon: "31-60",
      estimatedDays: 10,
      dependsOn: [],
      obligationId: obligations.find((o) => o.jurisdiction === country)?.id ?? "",
      blocking: true,
    });
  }

  for (const o of obligations.filter((x) => x.severity === "medium").slice(0, 3)) {
    actions.push({
      id: uuidv4(),
      title: `File: ${o.title}`,
      description: o.description.slice(0, 150),
      owner: ownerFor(o.category),
      horizon: "61-90",
      estimatedDays: 3,
      dependsOn: [],
      obligationId: o.id,
      blocking: false,
    });
  }

  return actions;
}
