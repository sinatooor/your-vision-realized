import { v4 as uuidv4 } from "uuid";
import { extractStructured } from "../lib/claude";
import { SSEStream, emitAgent } from "../lib/sse";
import { ExpansionTwin } from "../types";

const AGENT = "Agent 1 — Intake";

const SYSTEM_PROMPT = `You are a legal intelligence extraction system. Extract structured business facts from lawyer-provided client briefs. Return ONLY valid JSON matching the ExpansionTwin schema. No prose, no markdown fences, no explanation.
If a field cannot be determined, use null or [] or {}.
For hiresByCountry, use ISO 3166-1 alpha-2 codes (DE, VN, GB, SE, SG).
For industry, use plain English (e.g. 'HR SaaS', 'Fintech', 'E-commerce').
For dataCategories, choose from: hr, customer, financial, health, biometric, special-category, none.
For entityType, choose from: hq, eor, branch, subsidiary, representative, contractor, none.
Always include the company's home country in hiresByCountry if employees exist there.`;

const SCHEMA = `interface ExpansionTwin {
  id: string;                    // leave empty — will be generated
  createdAt: string;             // leave empty — will be generated
  company: {
    name: string;
    hqCountry: string;           // ISO 3166-1 alpha-2
    industry: string;
    size: number;                // total global headcount
    productCategory: string;
    hasAiFeatures: boolean;
  };
  expansion: {
    targetCountries: string[];   // ISO codes of NEW countries being expanded INTO
    timelineDays: number;
    launchDate?: string;
  };
  people: {
    hiresByCountry: Record<string, number>;
    arrangementByCountry: Record<string, "remote" | "hybrid" | "on-site">;
  };
  data: {
    categories: Array<"hr" | "customer" | "financial" | "health" | "biometric" | "special-category" | "none">;
    storageJurisdictions: string[];
    transferFlows: Array<{ from: string; to: string; categories: string[] }>;
    centralised: boolean;
  };
  entity: {
    currentByCountry: Record<string, "hq" | "eor" | "branch" | "subsidiary" | "representative" | "contractor" | "none">;
  };
  revenue: {
    localInvoicingByCountry: Record<string, boolean>;
  };
  rawBrief: string;              // leave empty — will be filled in
}`;

export async function extractExpansionTwin(
  brief: string,
  stream: SSEStream,
): Promise<ExpansionTwin> {
  emitAgent(stream, AGENT, "agent_start", "Parsing mandate brief…");

  const userPrompt = `Extract all business facts from this client brief and return a JSON object matching the ExpansionTwin schema exactly.

CLIENT BRIEF:
${brief}

SCHEMA DOCUMENTATION:
${SCHEMA}`;

  const raw = await extractStructured<ExpansionTwin>(SYSTEM_PROMPT, userPrompt, SCHEMA);

  const twin: ExpansionTwin = {
    ...raw,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    rawBrief: brief,
  };

  if (!twin.company) {
    twin.company = {
      name: "Unknown",
      hqCountry: "SE",
      industry: "Technology",
      size: 0,
      productCategory: "Software",
      hasAiFeatures: false,
    };
  }
  if (!twin.expansion) {
    twin.expansion = { targetCountries: [], timelineDays: 90 };
  }
  if (!twin.people) {
    twin.people = { hiresByCountry: {}, arrangementByCountry: {} };
  }
  if (!twin.data) {
    twin.data = { categories: [], storageJurisdictions: [], transferFlows: [], centralised: false };
  }
  if (!twin.entity) {
    twin.entity = { currentByCountry: {} };
  }
  if (!twin.revenue) {
    twin.revenue = { localInvoicingByCountry: {} };
  }

  const fieldCount = Object.keys(twin).length;
  const targetCountries = twin.expansion.targetCountries;
  const hireCount = Object.values(twin.people.hiresByCountry).reduce((a, b) => a + b, 0);

  emitAgent(stream, AGENT, "agent_complete", `Expansion Twin extracted — ${targetCountries.length} target countries, ${hireCount} planned hires`, {
    fieldCount,
    targetCountries,
    hireCount,
  });

  return twin;
}
