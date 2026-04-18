export interface Company {
  name: string;
  hqCountry: string;
  industry: string;
  size: number;
  productCategory: string;
  hasAiFeatures: boolean;
}

export interface PeopleFootprint {
  hiresByCountry: Record<string, number>;
  arrangementByCountry: Record<string, "remote" | "hybrid" | "on-site">;
}

export interface DataFootprint {
  categories: DataCategory[];
  storageJurisdictions: string[];
  transferFlows: DataFlow[];
  centralised: boolean;
}

export type DataCategory =
  | "hr" | "customer" | "financial" | "health"
  | "biometric" | "special-category" | "none";

export interface DataFlow {
  from: string;
  to: string;
  categories: DataCategory[];
}

export interface EntityStructure {
  currentByCountry: Record<string, EntityType>;
}

export type EntityType =
  | "hq" | "eor" | "branch" | "subsidiary"
  | "representative" | "contractor" | "none";

export interface RevenueFootprint {
  localInvoicingByCountry: Record<string, boolean>;
}

export interface ExpansionPlan {
  targetCountries: string[];
  timelineDays: number;
  launchDate?: string;
}

export interface ExpansionTwin {
  id: string;
  createdAt: string;
  company: Company;
  expansion: ExpansionPlan;
  people: PeopleFootprint;
  data: DataFootprint;
  entity: EntityStructure;
  revenue: RevenueFootprint;
  rawBrief: string;
}

export type ObligationCategory =
  | "tax" | "employment" | "data" | "licensing"
  | "sanctions" | "corporate";

export type Severity = "critical" | "high" | "medium" | "low";

export interface ObligationSource {
  citation: string;
  url: string;
  retrievedAt: string;
  isLive: boolean;
}

export type LegislationStatus = "in-force" | "proposed" | "upcoming";

export interface Obligation {
  id: string;
  jurisdiction: string;
  category: ObligationCategory;
  title: string;
  description: string;
  trigger: string;
  threshold: string | null;
  severity: Severity;
  source: ObligationSource;
  confidence: number;
  requiresLocalCounsel: boolean;
  /** Legal status of the underlying instrument. Undefined ≈ "in-force" (legacy records). */
  legislationStatus?: LegislationStatus;
  /** ISO date when the instrument takes (or took) effect. */
  effectiveDate?: string;
}

export type ConflictType =
  | "compatible" | "dependency" | "tension"
  | "conflict" | "trigger_risk";

export interface ConflictMitigation {
  option: string;
  description: string;
  operationalImpact: "low" | "medium" | "high";
}

export interface Conflict {
  id: string;
  obligationAId: string;
  obligationBId: string;
  type: ConflictType;
  explanation: string;
  impactedTwinFields: string[];
  mitigationOptions: ConflictMitigation[];
  severity: Severity;
  blocksExpansion: boolean;
}

export type ScenarioModel =
  | "eor" | "subsidiary" | "contractor-first" | "distributor";

export interface ScenarioScore {
  legalRisk: number;
  complianceBurden: number;
  timeToLaunchDays: number;
  operationalComplexity: number;
  confidencePenalty: number;
  total: number;
}

export interface Scenario {
  id: string;
  model: ScenarioModel;
  label: string;
  description: string;
  assumptions: string[];
  obligationsTriggered: string[];
  conflictsResolved: string[];
  conflictsRemaining: string[];
  score: ScenarioScore;
  recommended: boolean;
  rationale: string;
}

export type ActionOwner = "partner" | "associate" | "local-counsel" | "client";

export interface Action {
  id: string;
  title: string;
  description: string;
  owner: ActionOwner;
  horizon: "0-30" | "31-60" | "61-90";
  estimatedDays: number;
  dependsOn: string[];
  obligationId: string;
  blocking: boolean;
}

export interface AnalysisResult {
  id: string;
  twinId: string;
  createdAt: string;
  obligations: Obligation[];
  conflicts: Conflict[];
  scenarios: Scenario[];
  actions: Action[];
  recommendedScenario: ScenarioModel;
  executiveSummary: string;
  memoMarkdown: string;
}

export type AgentEventType =
  | "agent_start" | "agent_complete"
  | "api_call" | "api_result"
  | "conflict_detected" | "scenario_scored"
  | "memo_ready" | "error";

export interface AgentEvent {
  type: AgentEventType;
  agent: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

export interface PresenceData {
  employees: number;
  entityType: EntityType;
}

export type IndustryType =
  | "hr-saas"
  | "fintech"
  | "biomedical"
  | "manufacturing"
  | "e-commerce"
  | "logistics"
  | "legaltech"
  | "other";

export interface AnalysisParams {
  targetHeadcount: number;
  arrangement: "remote" | "hybrid" | "on-site";
  entityStructure: EntityType;
  startDate: string;
  dataType: "personal" | "hr-only" | "none";
  industry: IndustryType;
  revenueEur: "under-1m" | "1m-10m" | "10m-100m" | "over-100m";
  hasAiFeatures: boolean;
}
