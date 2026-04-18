import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface CompanyProfile {
  name: string;
  hqCountry: string;
  legalEntity: string;
  industry: string;
  headcount: number;
  revenue: string;
  productCategory: string;
  hasAiFeatures: boolean;
  founded: string;
  notes: string;
}

export interface FootprintEntry {
  iso: string;
  country: string;
  entityType: string;
  headcount: number;
  localInvoicing: boolean;
  notes: string;
}

export interface TransferFlow {
  from: string;
  to: string;
  categories: string;
}

export interface DataArchitecture {
  categories: string[];
  storageJurisdiction: string;
  centralized: boolean;
  transferFlows: TransferFlow[];
  retentionPolicy: string;
  dpaInPlace: boolean;
}

// ── Preset IDs ────────────────────────────────────────────────────────────────

export type PresetId = "nordhr" | "spotify" | "klarna" | "lovable";

export interface CompanyPreset {
  id: PresetId;
  label: string;
  tagline: string;
  company: CompanyProfile;
  footprint: FootprintEntry[];
  dataArch: DataArchitecture;
}

// ── Preset data ───────────────────────────────────────────────────────────────

export const COMPANY_PRESETS: Record<PresetId, CompanyPreset> = {
  nordhr: {
    id: "nordhr",
    label: "NordHR Technologies",
    tagline: "HR / HCM SaaS · Sweden",
    company: {
      name: "NordHR Technologies AB",
      hqCountry: "Sweden (SE)",
      legalEntity: "Aktiebolag (AB)",
      industry: "HR / HCM SaaS",
      headcount: 279,
      revenue: "€10 M – €100 M",
      productCategory: "B2B SaaS — HR & People Management",
      hasAiFeatures: true,
      founded: "2017",
      notes: "Expanding internationally with a compliance-first market entry strategy.",
    },
    footprint: [
      { iso: "SE", country: "Sweden", entityType: "Headquarters", headcount: 185, localInvoicing: true, notes: "Legal seat and parent entity. All IP held here." },
      { iso: "DE", country: "Germany", entityType: "Employer of Record", headcount: 48, localInvoicing: false, notes: "Sales & support via EOR. No local legal entity." },
      { iso: "SG", country: "Singapore", entityType: "Contractor", headcount: 12, localInvoicing: false, notes: "APAC engineering contractors. Misclassification risk to monitor." },
      { iso: "GB", country: "United Kingdom", entityType: "Employer of Record", headcount: 34, localInvoicing: false, notes: "Post-Brexit UK team via EOR. UK GDPR obligations apply." },
    ],
    dataArch: {
      categories: ["Employee Records", "Payroll Data", "Performance Analytics", "HR SaaS Platform Data"],
      storageJurisdiction: "Sweden (SE)",
      centralized: true,
      transferFlows: [
        { from: "SE", to: "DE", categories: "Employee records, payroll" },
        { from: "SE", to: "SG", categories: "Contractor records" },
        { from: "SE", to: "GB", categories: "Employee records, payroll" },
      ],
      retentionPolicy: "7 years (EU standard)",
      dpaInPlace: true,
    },
  },

  spotify: {
    id: "spotify",
    label: "Spotify",
    tagline: "Music Streaming · Sweden",
    company: {
      name: "Spotify AB",
      hqCountry: "Sweden (SE)",
      legalEntity: "Aktiebolag (AB) / Spotify Technology S.A. (Luxembourg)",
      industry: "Music Streaming / Entertainment Tech",
      headcount: 9200,
      revenue: "over €3 B",
      productCategory: "B2C Music & Podcast Streaming Platform",
      hasAiFeatures: true,
      founded: "2006",
      notes: "Global streaming leader. US operations dominate headcount; APAC and LatAm expansion ongoing. NYSE-listed via Luxembourg holding entity.",
    },
    footprint: [
      { iso: "SE", country: "Sweden", entityType: "Headquarters", headcount: 2200, localInvoicing: true, notes: "R&D hub and parent entity. Core engineering teams." },
      { iso: "US", country: "United States", entityType: "Subsidiary", headcount: 3100, localInvoicing: true, notes: "Spotify USA Inc. NYSE-listed operating entity. Americas HQ in NYC." },
      { iso: "GB", country: "United Kingdom", entityType: "Subsidiary", headcount: 800, localInvoicing: true, notes: "Spotify Ltd. Key advertising and content market." },
      { iso: "DE", country: "Germany", entityType: "Subsidiary", headcount: 420, localInvoicing: true, notes: "Spotify GmbH. Strong local royalty regulation environment." },
      { iso: "NL", country: "Netherlands", entityType: "Subsidiary", headcount: 310, localInvoicing: true, notes: "EU holding structure. VAT and transfer pricing implications." },
      { iso: "FR", country: "France", entityType: "Subsidiary", headcount: 180, localInvoicing: true, notes: "Significant market. French language content compliance obligations." },
      { iso: "AU", country: "Australia", entityType: "Subsidiary", headcount: 180, localInvoicing: true, notes: "APAC regional hub. ACL and Privacy Act compliance." },
      { iso: "JP", country: "Japan", entityType: "Subsidiary", headcount: 130, localInvoicing: true, notes: "High-value market. Local content licensing and APPI requirements." },
    ],
    dataArch: {
      categories: ["User Listening History", "Payment & Billing Data", "Behavioural Analytics", "Device & Location Data", "Podcast Interaction Data"],
      storageJurisdiction: "Sweden (SE) + USA (US) — distributed",
      centralized: false,
      transferFlows: [
        { from: "EU", to: "US", categories: "User data, analytics (SCCs in place)" },
        { from: "US", to: "SE", categories: "Aggregated analytics, financial data" },
        { from: "SE", to: "AU", categories: "User data for APAC market" },
        { from: "SE", to: "JP", categories: "User data for Japan (APPI SCCs)" },
      ],
      retentionPolicy: "3 years (user data) / 7 years (financial)",
      dpaInPlace: true,
    },
  },

  klarna: {
    id: "klarna",
    label: "Klarna",
    tagline: "Fintech / Banking · Sweden",
    company: {
      name: "Klarna Bank AB",
      hqCountry: "Sweden (SE)",
      legalEntity: "Licensed Bank (Klarna Bank AB) — Finansinspektionen",
      industry: "Fintech / BNPL / Consumer Banking",
      headcount: 5000,
      revenue: "over €2 B",
      productCategory: "Buy Now Pay Later + Consumer Banking Platform",
      hasAiFeatures: true,
      founded: "2005",
      notes: "Swedish-licensed bank regulated by Finansinspektionen. US IPO preparation ongoing. High regulatory exposure across all markets; banking licence adds significant compliance overhead.",
    },
    footprint: [
      { iso: "SE", country: "Sweden", entityType: "Headquarters (Licensed Bank)", headcount: 2500, localInvoicing: true, notes: "Banking licence held here. Regulated by Finansinspektionen. Parent entity." },
      { iso: "DE", country: "Germany", entityType: "Branch (Banking)", headcount: 620, localInvoicing: true, notes: "Largest European market by GMV. BaFin regulated branch. Strong consumer rights exposure." },
      { iso: "GB", country: "United Kingdom", entityType: "Authorised Payment Institution", headcount: 520, localInvoicing: true, notes: "FCA-authorised. Separate UK entity post-Brexit. No longer covered by EU passport." },
      { iso: "US", country: "United States", entityType: "Subsidiary", headcount: 420, localInvoicing: true, notes: "Klarna Inc. State-by-state licensing regime. CFPB oversight. Pre-IPO entity." },
      { iso: "NL", country: "Netherlands", entityType: "Branch (Banking)", headcount: 210, localInvoicing: true, notes: "EU passporting hub. DNB oversight. Key for LatAm/EU routing." },
      { iso: "NO", country: "Norway", entityType: "Branch (Banking)", headcount: 110, localInvoicing: true, notes: "Core Nordic market. Finanstilsynet regulated." },
      { iso: "FI", country: "Finland", entityType: "Branch (Banking)", headcount: 90, localInvoicing: true, notes: "FIN-FSA regulated branch. Nordic BNPL market." },
      { iso: "AU", country: "Australia", entityType: "Employer of Record", headcount: 80, localInvoicing: false, notes: "APAC growth market. AFSL considerations being assessed for full expansion." },
    ],
    dataArch: {
      categories: ["Financial Transaction Data", "Credit Assessment Data", "Personal & Identity Data", "Fraud Detection Signals", "Open Banking Data"],
      storageJurisdiction: "Sweden (SE) — primary, EU data residency enforced",
      centralized: true,
      transferFlows: [
        { from: "SE", to: "DE", categories: "Customer financial data, credit decisions" },
        { from: "SE", to: "GB", categories: "UK customer data (UK GDPR transfer mechanism)" },
        { from: "SE", to: "US", categories: "Aggregated analytics only (SCCs/adequacy)" },
        { from: "DE", to: "SE", categories: "Fraud signals, transaction logs" },
      ],
      retentionPolicy: "10 years (banking regulatory requirement)",
      dpaInPlace: true,
    },
  },

  lovable: {
    id: "lovable",
    label: "Lovable",
    tagline: "AI DevTools · Sweden",
    company: {
      name: "Lovable (GPT Engineer AB)",
      hqCountry: "Sweden (SE)",
      legalEntity: "Aktiebolag (AB)",
      industry: "AI-Powered Developer Tools",
      headcount: 82,
      revenue: "€10 M – €100 M",
      productCategory: "AI Full-Stack Application Generator (B2B/B2C SaaS)",
      hasAiFeatures: true,
      founded: "2023",
      notes: "High-growth AI startup. Rapid international hiring via EOR. EU AI Act obligations central to product roadmap. LLM API dependencies on US providers create cross-border data flow obligations.",
    },
    footprint: [
      { iso: "SE", country: "Sweden", entityType: "Headquarters", headcount: 45, localInvoicing: true, notes: "Core engineering, product, and leadership. Parent entity. All IP held here." },
      { iso: "US", country: "United States", entityType: "Employer of Record", headcount: 22, localInvoicing: false, notes: "Sales and developer relations via EOR. Key US customer market." },
      { iso: "GB", country: "United Kingdom", entityType: "Employer of Record", headcount: 9, localInvoicing: false, notes: "European sales support. UK GDPR obligations apply via EOR." },
      { iso: "DE", country: "Germany", entityType: "Employer of Record", headcount: 4, localInvoicing: false, notes: "DACH market support. GDPR-aligned EOR structure." },
      { iso: "FR", country: "France", entityType: "Contractor", headcount: 2, localInvoicing: false, notes: "AI research contractors. Misclassification risk under French labour law being reviewed." },
    ],
    dataArch: {
      categories: ["User Code & Project Data", "LLM Prompt & Output Logs", "Personal & Account Data", "Usage & Telemetry Data"],
      storageJurisdiction: "Sweden (SE) via EU-hosted cloud provider",
      centralized: true,
      transferFlows: [
        { from: "SE", to: "US", categories: "LLM API calls to OpenAI/Anthropic, telemetry" },
        { from: "US", to: "SE", categories: "Model outputs, user session responses" },
        { from: "SE", to: "GB", categories: "User account data for UK customers" },
      ],
      retentionPolicy: "2 years (user data) / 5 years (financial)",
      dpaInPlace: true,
    },
  },
};

// ── localStorage helpers ──────────────────────────────────────────────────────

function readLocal<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface CompanyContextValue {
  company: CompanyProfile;
  footprint: FootprintEntry[];
  dataArch: DataArchitecture;
  activePreset: PresetId | null;
  setCompany: (updater: CompanyProfile | ((prev: CompanyProfile) => CompanyProfile)) => void;
  setFootprint: (updater: FootprintEntry[] | ((prev: FootprintEntry[]) => FootprintEntry[])) => void;
  setDataArch: (updater: DataArchitecture | ((prev: DataArchitecture) => DataArchitecture)) => void;
  loadPreset: (id: PresetId) => void;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

const DEFAULT_PRESET = COMPANY_PRESETS.nordhr;

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [activePreset, setActivePreset] = useState<PresetId | null>(
    () => readLocal<PresetId | null>("tg_active_preset", "nordhr"),
  );

  const [company, setCompanyRaw] = useState<CompanyProfile>(
    () => readLocal("tg_company_profile", DEFAULT_PRESET.company),
  );

  const [footprint, setFootprintRaw] = useState<FootprintEntry[]>(
    () => readLocal("tg_footprint", DEFAULT_PRESET.footprint),
  );

  const [dataArch, setDataArchRaw] = useState<DataArchitecture>(
    () => readLocal("tg_data_arch", DEFAULT_PRESET.dataArch),
  );

  const setCompany = useCallback(
    (updater: CompanyProfile | ((prev: CompanyProfile) => CompanyProfile)) => {
      setCompanyRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        writeLocal("tg_company_profile", next);
        return next;
      });
      setActivePreset(null);
      writeLocal("tg_active_preset", null);
    },
    [],
  );

  const setFootprint = useCallback(
    (updater: FootprintEntry[] | ((prev: FootprintEntry[]) => FootprintEntry[])) => {
      setFootprintRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        writeLocal("tg_footprint", next);
        return next;
      });
      setActivePreset(null);
      writeLocal("tg_active_preset", null);
    },
    [],
  );

  const setDataArch = useCallback(
    (updater: DataArchitecture | ((prev: DataArchitecture) => DataArchitecture)) => {
      setDataArchRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        writeLocal("tg_data_arch", next);
        return next;
      });
      setActivePreset(null);
      writeLocal("tg_active_preset", null);
    },
    [],
  );

  const loadPreset = useCallback((id: PresetId) => {
    const preset = COMPANY_PRESETS[id];
    setCompanyRaw(preset.company);
    setFootprintRaw(preset.footprint);
    setDataArchRaw(preset.dataArch);
    setActivePreset(id);
    writeLocal("tg_company_profile", preset.company);
    writeLocal("tg_footprint", preset.footprint);
    writeLocal("tg_data_arch", preset.dataArch);
    writeLocal("tg_active_preset", id);
  }, []);

  return (
    <CompanyContext.Provider
      value={{ company, footprint, dataArch, activePreset, setCompany, setFootprint, setDataArch, loadPreset }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
