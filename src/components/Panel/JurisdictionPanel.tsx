import { useState } from "react";
import { AnalysisParams, EntityType, IndustryType, PresenceData } from "@/types";

interface JurisdictionPanelProps {
  country: { iso: string; name: string } | null;
  presence: PresenceData | null;
  onClose: () => void;
  onRunAnalysis: (params: AnalysisParams) => void;
  isRunning: boolean;
}

const ENTITY_OPTIONS: EntityType[] = ["eor", "subsidiary", "branch", "representative", "contractor"];
const ENTITY_LABELS: Record<EntityType, string> = {
  hq: "HQ",
  eor: "Employer of Record",
  branch: "Branch Office",
  subsidiary: "Local Subsidiary",
  representative: "Representative Office",
  contractor: "Contractor",
  none: "None",
};

const INDUSTRY_OPTIONS: { value: IndustryType; label: string }[] = [
  { value: "hr-saas", label: "HR / HCM SaaS" },
  { value: "fintech", label: "Fintech / Payments" },
  { value: "biomedical", label: "Biomedical / Pharma" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "e-commerce", label: "E-Commerce / Retail" },
  { value: "logistics", label: "Logistics / Supply Chain" },
  { value: "legaltech", label: "LegalTech" },
  { value: "other", label: "Other" },
];

const REVENUE_OPTIONS: { value: AnalysisParams["revenueEur"]; label: string }[] = [
  { value: "under-1m", label: "< €1 M" },
  { value: "1m-10m", label: "€1 M – €10 M" },
  { value: "10m-100m", label: "€10 M – €100 M" },
  { value: "over-100m", label: "> €100 M" },
];

export function JurisdictionPanel({ country, presence, onClose, onRunAnalysis, isRunning }: JurisdictionPanelProps) {
  const [headcount, setHeadcount] = useState(3);
  const [arrangement, setArrangement] = useState<"remote" | "hybrid" | "on-site">("remote");
  const [entityStructure, setEntityStructure] = useState<EntityType>("eor");
  const [startDate, setStartDate] = useState("");
  const [dataType, setDataType] = useState<"personal" | "hr-only" | "none">("hr-only");
  const [industry, setIndustry] = useState<IndustryType>("hr-saas");
  const [revenueEur, setRevenueEur] = useState<AnalysisParams["revenueEur"]>("1m-10m");
  const [hasAiFeatures, setHasAiFeatures] = useState(false);

  const handleSubmit = () => {
    onRunAnalysis({ targetHeadcount: headcount, arrangement, entityStructure, startDate, dataType, industry, revenueEur, hasAiFeatures });
  };

  return (
    <div
      className="fixed right-0 top-[89px] bottom-8 w-[340px] bg-surface-container border-l border-outline-variant flex flex-col z-50 overflow-y-auto transition-transform duration-350"
      style={{ transform: country ? "translateX(0)" : "translateX(100%)" }}
    >
      {country && (
        <>
          {/* Header */}
          <div className="px-6 py-5 border-b border-outline-variant">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-headline text-xl font-bold text-primary">{country.name}</h2>
                <p className="font-mono text-[9px] tracking-widest uppercase text-outline mt-1">
                  {country.iso} · EXPANSION TARGET
                </p>
              </div>
              <button
                onClick={onClose}
                className="font-mono text-[10px] tracking-widest uppercase border border-outline-variant px-2 py-1 text-outline hover:text-primary transition-colors"
              >
                CLOSE
              </button>
            </div>
          </div>

          {/* Current Presence */}
          {presence && (
            <div className="px-6 py-4 border-b border-outline-variant">
              <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-3">
                CURRENT PRESENCE
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-outline-variant p-3">
                  <div className="font-headline text-2xl font-bold text-primary">{presence.employees}</div>
                  <div className="font-mono text-[9px] tracking-widest uppercase text-outline">EMPLOYEES</div>
                </div>
                <div className="border border-outline-variant p-3">
                  <div className="font-headline text-sm font-bold text-primary uppercase">{presence.entityType}</div>
                  <div className="font-mono text-[9px] tracking-widest uppercase text-outline">STRUCTURE</div>
                </div>
              </div>
            </div>
          )}

          {/* Expansion Form */}
          <div className="px-6 py-4 flex-1">
            <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-4">
              EXPANSION PARAMETERS
            </p>

            {/* Headcount */}
            <div className="mb-4">
              <label className="font-mono text-[9px] tracking-widest uppercase text-outline block mb-2">
                TARGET HEADCOUNT
              </label>
              <div className="flex items-center border border-outline-variant">
                <button
                  onClick={() => setHeadcount((v) => Math.max(1, v - 1))}
                  className="px-4 py-2 font-mono text-sm text-outline hover:text-primary border-r border-outline-variant"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={headcount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1) setHeadcount(v);
                  }}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setHeadcount(isNaN(v) || v < 1 ? 1 : v);
                  }}
                  className="flex-1 text-center font-headline text-lg font-bold text-primary py-2 bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setHeadcount((v) => v + 1)}
                  className="px-4 py-2 font-mono text-sm text-outline hover:text-primary border-l border-outline-variant"
                >
                  +
                </button>
              </div>
            </div>

            {/* Work arrangement */}
            <div className="mb-4">
              <label className="font-mono text-[9px] tracking-widest uppercase text-outline block mb-2">
                WORK ARRANGEMENT
              </label>
              <div className="flex border border-outline-variant">
                {(["remote", "hybrid", "on-site"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setArrangement(opt)}
                    className={`flex-1 py-2 font-mono text-[9px] tracking-widest uppercase transition-colors ${
                      arrangement === opt
                        ? "bg-primary text-primary-foreground"
                        : "text-outline hover:text-primary"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Entity structure */}
            <div className="mb-4">
              <label className="font-mono text-[9px] tracking-widest uppercase text-outline block mb-2">
                ENTITY STRUCTURE
              </label>
              <select
                value={entityStructure}
                onChange={(e) => setEntityStructure(e.target.value as EntityType)}
                className="w-full border border-outline-variant bg-surface font-mono text-[10px] tracking-widest uppercase text-primary py-2 px-3"
              >
                {ENTITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{ENTITY_LABELS[opt]}</option>
                ))}
              </select>
            </div>

            {/* Data type */}
            <div className="mb-4">
              <label className="font-mono text-[9px] tracking-widest uppercase text-outline block mb-2">
                DATA PROCESSED
              </label>
              <div className="flex border border-outline-variant">
                {([
                  { value: "personal", label: "PERSONAL" },
                  { value: "hr-only", label: "HR ONLY" },
                  { value: "none", label: "NONE" },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setDataType(value)}
                    className={`flex-1 py-2 font-mono text-[9px] tracking-widest uppercase transition-colors ${
                      dataType === value
                        ? "bg-primary text-primary-foreground"
                        : "text-outline hover:text-primary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Industry */}
            <div className="mb-4">
              <label className="font-mono text-[9px] tracking-widest uppercase text-outline block mb-2">
                INDUSTRY
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value as IndustryType)}
                className="w-full border border-outline-variant bg-surface font-mono text-[10px] tracking-widest uppercase text-primary py-2 px-3"
              >
                {INDUSTRY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Revenue band */}
            <div className="mb-4">
              <label className="font-mono text-[9px] tracking-widest uppercase text-outline block mb-2">
                ANNUAL REVENUE
              </label>
              <div className="grid grid-cols-2 gap-1">
                {REVENUE_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setRevenueEur(value)}
                    className={`py-2 font-mono text-[9px] tracking-widest uppercase transition-colors border ${
                      revenueEur === value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "text-outline border-outline-variant hover:text-primary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI features toggle */}
            <div className="mb-4 flex items-center justify-between">
              <label className="font-mono text-[9px] tracking-widest uppercase text-outline">
                PRODUCT HAS AI FEATURES
              </label>
              <button
                onClick={() => setHasAiFeatures((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative ${hasAiFeatures ? "bg-primary" : "bg-outline-variant"}`}
              >
                <span
                  className={`absolute top-0.5 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform ${hasAiFeatures ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Start date */}
            <div className="mb-6">
              <label className="font-mono text-[9px] tracking-widest uppercase text-outline block mb-2">
                PLANNED START
              </label>
              <input
                type="month"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-outline-variant bg-surface font-mono text-[10px] tracking-widest text-primary py-2 px-3"
              />
            </div>

            {/* CTA */}
            <button
              onClick={handleSubmit}
              disabled={isRunning}
              className="w-full bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase py-4 hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isRunning ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  ANALYSING…
                </>
              ) : (
                "RUN CONFLICT ANALYSIS →"
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
