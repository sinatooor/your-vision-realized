import { readFileSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { SSEStream, emitAgent } from "../lib/sse";
import { Conflict, ConflictMitigation, ConflictType, ExpansionTwin, Obligation, Severity } from "../types";

const AGENT = "Agent 3 — Conflict Engine";

interface ConflictRule {
  id: string;
  name: string;
  jurisdictionA: string;
  jurisdictionB: string | null;
  categoryA: string;
  categoryB: string | null;
  twinCondition: string;
  type: ConflictType;
  severity: Severity;
  explanation: string;
  blocksExpansion: boolean;
  mitigationOptions: ConflictMitigation[];
}

function loadConflictRules(): ConflictRule[] {
  const raw = readFileSync(join(__dirname, "../data/rule-packs/conflicts.json"), "utf-8");
  return JSON.parse(raw) as ConflictRule[];
}

function evaluateCondition(rule: ConflictRule, twin: ExpansionTwin): boolean {
  const targets = twin.expansion.targetCountries;
  const hqCountry = twin.company.hqCountry;
  const allCountries = [hqCountry, ...targets];
  const deHires = twin.people.hiresByCountry["DE"] ?? 0;
  const deEntity = twin.entity.currentByCountry["DE"] ?? "none";

  switch (rule.id) {
    case "CONF-001":
      return (
        twin.data.centralised === true &&
        (twin.data.categories.includes("hr") || twin.data.categories.includes("special-category")) &&
        targets.includes("DE") &&
        targets.includes("VN")
      );
    case "CONF-002":
      return (
        targets.includes("GB") &&
        (allCountries.includes("DE") || allCountries.includes("SE")) &&
        (twin.data.categories.includes("hr") ||
          twin.data.categories.includes("customer") ||
          twin.data.categories.includes("financial"))
      );
    case "CONF-003":
      return (
        deHires >= 3 &&
        (deEntity === "eor" || deEntity === "none") &&
        (targets.includes("DE") || hqCountry === "SE")
      );
    case "CONF-004":
      return deHires >= 5 && targets.includes("DE");
    case "CONF-005":
      return (
        twin.data.categories.includes("hr") ||
        twin.data.categories.includes("special-category")
      ) && (targets.includes("DE") || targets.includes("SE") || hqCountry === "DE" || hqCountry === "SE");
    default:
      return false;
  }
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function detectConflicts(
  twin: ExpansionTwin,
  obligations: Obligation[],
  stream: SSEStream,
): Promise<Conflict[]> {
  emitAgent(stream, AGENT, "agent_start", "Cross-jurisdiction conflict analysis initiated…");

  const rules = loadConflictRules();
  const conflicts: Conflict[] = [];

  for (const rule of rules) {
    if (!evaluateCondition(rule, twin)) continue;

    const obligationA = obligations.find(
      (o) => o.jurisdiction === rule.jurisdictionA && o.category === rule.categoryA,
    );
    const obligationB = rule.jurisdictionB
      ? obligations.find(
          (o) => o.jurisdiction === rule.jurisdictionB && o.category === rule.categoryB,
        )
      : null;

    const conflict: Conflict = {
      id: uuidv4(),
      obligationAId: obligationA?.id ?? rule.jurisdictionA,
      obligationBId: obligationB?.id ?? rule.jurisdictionB ?? "",
      type: rule.type,
      explanation: rule.explanation,
      impactedTwinFields: getImpactedFields(rule.id),
      mitigationOptions: rule.mitigationOptions,
      severity: rule.severity,
      blocksExpansion: rule.blocksExpansion,
    };

    conflicts.push(conflict);

    emitAgent(stream, AGENT, "conflict_detected", `${rule.severity === "critical" ? "🔴" : rule.severity === "high" ? "🟠" : "🟡"} ${rule.severity.toUpperCase()}: ${rule.name}`, {
      conflictId: conflict.id,
      type: rule.type,
      severity: rule.severity,
      blocksExpansion: rule.blocksExpansion,
      name: rule.name,
    });
  }

  conflicts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const bySeverity = conflicts.reduce<Record<string, number>>((acc, c) => {
    acc[c.severity] = (acc[c.severity] ?? 0) + 1;
    return acc;
  }, {});

  emitAgent(stream, AGENT, "agent_complete", `Conflict analysis complete — ${conflicts.length} conflict(s) detected`, {
    total: conflicts.length,
    bySeverity,
    blockers: conflicts.filter((c) => c.blocksExpansion).length,
  });

  return conflicts;
}

function getImpactedFields(ruleId: string): string[] {
  switch (ruleId) {
    case "CONF-001": return ["data.centralised", "data.storageJurisdictions", "expansion.targetCountries"];
    case "CONF-002": return ["data.transferFlows", "expansion.targetCountries"];
    case "CONF-003": return ["people.hiresByCountry.DE", "entity.currentByCountry.DE"];
    case "CONF-004": return ["people.hiresByCountry.DE", "expansion.timelineDays"];
    case "CONF-005": return ["data.categories", "data.centralised"];
    default: return [];
  }
}
