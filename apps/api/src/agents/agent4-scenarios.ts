import { v4 as uuidv4 } from "uuid";
import { generateText } from "../lib/claude";
import { SSEStream, emitAgent } from "../lib/sse";
import { Conflict, ExpansionTwin, Obligation, Scenario, ScenarioModel, ScenarioScore } from "../types";

const AGENT = "Agent 4 — Scenario Simulator";

interface ScenarioBase {
  model: ScenarioModel;
  label: string;
  description: string;
  assumptions: string[];
  baseComplianceBurden: number;
  timeToLaunchDays: number;
  operationalComplexity: number;
}

const SCENARIOS: ScenarioBase[] = [
  {
    model: "eor",
    label: "Employer of Record (EOR)",
    description: "Hire through a third-party EOR in each target jurisdiction. No local entity required. Faster to launch, higher per-head cost.",
    assumptions: [
      "EOR provider available in all target jurisdictions",
      "No plans to invoice locally through own entity",
      "Headcount remains below PE trigger thresholds",
    ],
    baseComplianceBurden: 30,
    timeToLaunchDays: 14,
    operationalComplexity: 40,
  },
  {
    model: "subsidiary",
    label: "Local Subsidiary",
    description: "Incorporate a wholly-owned subsidiary in each target jurisdiction. Full legal presence. Higher setup cost and compliance burden.",
    assumptions: [
      "Company has capital available for incorporation",
      "Willing to wait 4–8 weeks for entity setup",
      "Plans to invoice locally through own entity",
    ],
    baseComplianceBurden: 80,
    timeToLaunchDays: 45,
    operationalComplexity: 75,
  },
  {
    model: "contractor-first",
    label: "Contractor-First",
    description: "Engage local freelancers/contractors initially. Transition to employment or entity once commercial viability is confirmed.",
    assumptions: [
      "Contractors are genuinely independent (IR35/re-classification risk assessed)",
      "Initial engagement is ≤12 months",
      "No special-category data processed by contractors",
    ],
    baseComplianceBurden: 20,
    timeToLaunchDays: 7,
    operationalComplexity: 20,
  },
  {
    model: "distributor",
    label: "Distributor / Reseller Model",
    description: "Partner with a local distributor or reseller. No local employment. Market entry via third-party commercial agreement.",
    assumptions: [
      "Product can be sold via third-party channel",
      "Transfer pricing documentation required",
      "No local data processing by own entity",
    ],
    baseComplianceBurden: 25,
    timeToLaunchDays: 30,
    operationalComplexity: 35,
  },
];

function getResolvedConflicts(model: ScenarioModel, conflicts: Conflict[], twin: ExpansionTwin): string[] {
  const deHires = twin.people.hiresByCountry["DE"] ?? 0;
  const resolved: string[] = [];
  for (const c of conflicts) {
    switch (model) {
      case "eor":
        if (c.id && (c.explanation.includes("PE") || c.explanation.includes("Permanent Establishment")) && deHires < 5) resolved.push(c.id);
        break;
      case "subsidiary":
        if (c.id && (c.explanation.includes("PE") || c.explanation.includes("Permanent Establishment"))) resolved.push(c.id);
        break;
      case "contractor-first":
        if (c.id && (c.explanation.includes("PE") || c.explanation.includes("Permanent Establishment"))) resolved.push(c.id);
        if (c.id && c.explanation.includes("Works Council")) resolved.push(c.id);
        break;
      case "distributor":
        if (c.id && (c.explanation.includes("PE") || c.explanation.includes("Permanent Establishment"))) resolved.push(c.id);
        if (c.id && c.explanation.includes("Works Council")) resolved.push(c.id);
        if (c.id && c.explanation.includes("data localisation") && model === "distributor") resolved.push(c.id);
        break;
    }
  }
  return [...new Set(resolved)];
}

function computeScore(
  base: ScenarioBase,
  conflicts: Conflict[],
  obligations: Obligation[],
  resolved: string[],
): ScenarioScore {
  const resolvedSet = new Set(resolved);
  let legalRisk = 0;
  for (const c of conflicts) {
    if (resolvedSet.has(c.id)) continue;
    if (c.severity === "critical") legalRisk += 25;
    else if (c.severity === "high") legalRisk += 15;
    else if (c.severity === "medium") legalRisk += 5;
  }
  legalRisk = Math.min(legalRisk, 100);

  const lowConfObligations = obligations.filter((o) => o.confidence < 0.8).length;
  const confidencePenalty = Math.min(lowConfObligations * 5, 20);

  const total =
    legalRisk * 0.35 +
    base.baseComplianceBurden * 0.25 +
    ((base.timeToLaunchDays / 90) * 100) * 0.2 +
    base.operationalComplexity * 0.1 +
    confidencePenalty * 0.1;

  return {
    legalRisk,
    complianceBurden: base.baseComplianceBurden,
    timeToLaunchDays: base.timeToLaunchDays,
    operationalComplexity: base.operationalComplexity,
    confidencePenalty,
    total: Math.round(total * 10) / 10,
  };
}

async function generateRationale(
  twin: ExpansionTwin,
  model: ScenarioModel,
  score: ScenarioScore,
  resolvedConflicts: string[],
  remainingConflicts: string[],
): Promise<string> {
  const prompt = `Write a single concise paragraph (2-3 sentences) explaining why the "${model}" structure scores ${score.total.toFixed(1)}/100 for ${twin.company.name} expanding to ${twin.expansion.targetCountries.join(", ")}. Mention ${resolvedConflicts.length} resolved conflicts and ${remainingConflicts.length} remaining. Include estimated launch time of ${score.timeToLaunchDays} days. Be direct and specific.`;
  try {
    return await generateText("You are a senior international law partner. Be concise and precise.", prompt, 256);
  } catch {
    return `The ${model} structure scores ${score.total.toFixed(1)}/100. It resolves ${resolvedConflicts.length} conflict(s) and leaves ${remainingConflicts.length} unresolved. Estimated time to operational: ${score.timeToLaunchDays} days.`;
  }
}

export async function simulateScenarios(
  twin: ExpansionTwin,
  obligations: Obligation[],
  conflicts: Conflict[],
  stream: SSEStream,
): Promise<Scenario[]> {
  emitAgent(stream, AGENT, "agent_start", "Simulating expansion structure scenarios…");

  const scored: Array<Scenario & { _total: number }> = [];

  for (const base of SCENARIOS) {
    const resolved = getResolvedConflicts(base.model, conflicts, twin);
    const remaining = conflicts.filter((c) => !resolved.includes(c.id)).map((c) => c.id);
    const score = computeScore(base, conflicts, obligations, resolved);

    const rationale = await generateRationale(twin, base.model, score, resolved, remaining);

    const scenario: Scenario & { _total: number } = {
      id: uuidv4(),
      model: base.model,
      label: base.label,
      description: base.description,
      assumptions: base.assumptions,
      obligationsTriggered: obligations.map((o) => o.id),
      conflictsResolved: resolved,
      conflictsRemaining: remaining,
      score,
      recommended: false,
      rationale,
      _total: score.total,
    };

    scored.push(scenario);

    emitAgent(stream, AGENT, "scenario_scored", `Scored: ${base.label} — ${score.total.toFixed(1)}/100 (legal risk: ${score.legalRisk}, launch: ${score.timeToLaunchDays}d)`, {
      model: base.model,
      total: score.total,
      legalRisk: score.legalRisk,
      timeToLaunchDays: score.timeToLaunchDays,
    });
  }

  scored.sort((a, b) => a._total - b._total);
  if (scored.length > 0) scored[0].recommended = true;

  const scenarios = scored.map(({ _total: _t, ...s }) => {
    void _t;
    return s;
  });

  emitAgent(stream, AGENT, "agent_complete", `Scenario simulation complete — recommended: ${scenarios.find((s) => s.recommended)?.label ?? "N/A"}`, {
    recommended: scenarios.find((s) => s.recommended)?.model,
    scores: scenarios.map((s) => ({ model: s.model, total: s.score.total })),
  });

  return scenarios;
}
