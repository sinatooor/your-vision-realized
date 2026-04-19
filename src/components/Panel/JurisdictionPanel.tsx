import { useAnalysis, type ExpansionCase } from "@/contexts/AnalysisContext";
import { AnalysisParams, EntityType, IndustryType } from "@/types";
import { MaterialIcon } from "@/components/MaterialIcon";

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

interface CaseFormProps {
  caseItem: ExpansionCase;
  index: number;
  total: number;
  isActive: boolean;
  onActivate: () => void;
  onUpdate: (patch: Partial<AnalysisParams>) => void;
  onRemove: () => void;
}

function CaseForm({ caseItem, index, total, isActive, onActivate, onUpdate, onRemove }: CaseFormProps) {
  const params = caseItem.params;
  return (
    <div className="border-b border-outline-variant">
      {/* Case header */}
      <button
        type="button"
        onClick={onActivate}
        className={`w-full px-6 py-3 flex items-center justify-between text-left transition-colors ${
          isActive ? "bg-surface" : "bg-surface-container hover:bg-surface"
        }`}
      >
        <div className="min-w-0">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline">
            EXPANSION PLAN {index + 1}
          </p>
          <p className="font-headline text-sm font-bold text-primary truncate">
            {caseItem.name} <span className="text-outline font-mono text-[10px]">· {caseItem.iso}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {total > 1 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove();
                }
              }}
              className="p-1.5 text-outline hover:text-critical transition-colors cursor-pointer"
              aria-label={`Remove expansion plan ${index + 1}`}
              title="Remove this plan"
            >
              <MaterialIcon name="delete" className="text-[16px]" />
            </span>
          )}
          <MaterialIcon
            name={isActive ? "expand_less" : "expand_more"}
            className="text-[18px] text-outline"
          />
        </div>
      </button>

      {/* Form body */}
      {isActive && (
        <div className="px-6 py-4">
          {/* Headcount */}
          <div className="mb-4">
            <label className="font-mono text-[9px] tracking-widest uppercase text-outline block mb-2">
              TARGET HEADCOUNT
            </label>
            <div className="flex items-center border border-outline-variant">
              <button
                onClick={() => onUpdate({ targetHeadcount: Math.max(1, params.targetHeadcount - 1) })}
                className="px-4 py-2 font-mono text-sm text-outline hover:text-primary border-r border-outline-variant"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                value={params.targetHeadcount}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1) onUpdate({ targetHeadcount: v });
                }}
                onBlur={(e) => {
                  const v = parseInt(e.target.value, 10);
                  onUpdate({ targetHeadcount: isNaN(v) || v < 1 ? 1 : v });
                }}
                className="flex-1 text-center font-headline text-lg font-bold text-primary py-2 bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => onUpdate({ targetHeadcount: params.targetHeadcount + 1 })}
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
                  onClick={() => onUpdate({ arrangement: opt })}
                  className={`flex-1 py-2 font-mono text-[9px] tracking-widest uppercase transition-colors ${
                    params.arrangement === opt
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
              value={params.entityStructure}
              onChange={(e) => onUpdate({ entityStructure: e.target.value as EntityType })}
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
                  onClick={() => onUpdate({ dataType: value })}
                  className={`flex-1 py-2 font-mono text-[9px] tracking-widest uppercase transition-colors ${
                    params.dataType === value
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
              value={params.industry}
              onChange={(e) => onUpdate({ industry: e.target.value as IndustryType })}
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
                  onClick={() => onUpdate({ revenueEur: value })}
                  className={`py-2 font-mono text-[9px] tracking-widest uppercase transition-colors border ${
                    params.revenueEur === value
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
              onClick={() => onUpdate({ hasAiFeatures: !params.hasAiFeatures })}
              className={`w-10 h-5 rounded-full transition-colors relative ${params.hasAiFeatures ? "bg-primary" : "bg-outline-variant"}`}
            >
              <span
                className={`absolute top-0.5 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform ${params.hasAiFeatures ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>

          {/* Start date */}
          <div className="mb-2">
            <label className="font-mono text-[9px] tracking-widest uppercase text-outline block mb-2">
              PLANNED START
            </label>
            <input
              type="month"
              value={params.startDate}
              onChange={(e) => onUpdate({ startDate: e.target.value })}
              className="w-full border border-outline-variant bg-surface font-mono text-[10px] tracking-widest text-primary py-2 px-3"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function JurisdictionPanel() {
  const {
    cases,
    activeCaseId,
    activeCountry,
    isAddingCase,
    isRunning,
    handleClose,
    handleRunAnalysis,
    updateCaseParams,
    removeCase,
    setActiveCaseId,
    beginAddCase,
    cancelAddCase,
  } = useAnalysis();

  const isOpen = cases.length > 0 || activeCountry !== null;
  const headerCountry = cases.length === 0 ? activeCountry : null;

  return (
    <div
      className="fixed right-0 top-[89px] bottom-8 w-[340px] bg-surface-container border-l border-outline-variant flex flex-col z-50 overflow-y-auto transition-transform duration-350"
      style={{ transform: isOpen ? "translateX(0)" : "translateX(100%)" }}
    >
      {isOpen && (
        <>
          {/* Header */}
          <div className="px-6 py-5 border-b border-outline-variant">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <h2 className="font-headline text-xl font-bold text-primary truncate">
                  {cases.length > 1
                    ? "Expansion Programme"
                    : (cases[0]?.name ?? headerCountry?.name ?? "")}
                </h2>
                <p className="font-mono text-[9px] tracking-widest uppercase text-outline mt-1">
                  {cases.length > 1
                    ? `${cases.length} EXPANSION PLANS · COMBINED ANALYSIS`
                    : `${cases[0]?.iso ?? headerCountry?.iso ?? ""} · EXPANSION TARGET`}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="font-mono text-[10px] tracking-widest uppercase border border-outline-variant px-2 py-1 text-outline hover:text-primary transition-colors shrink-0 ml-2"
              >
                CLOSE
              </button>
            </div>
          </div>

          {/* Cases list */}
          <div className="flex-1">
            {cases.map((c, idx) => (
              <CaseForm
                key={c.id}
                caseItem={c}
                index={idx}
                total={cases.length}
                isActive={c.id === activeCaseId}
                onActivate={() => setActiveCaseId(c.id)}
                onUpdate={(patch) => updateCaseParams(c.id, patch)}
                onRemove={() => removeCase(c.id)}
              />
            ))}
          </div>

          {/* Footer actions */}
          {cases.length > 0 && (
            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container space-y-2">
              {/* Add another country */}
              <button
                onClick={beginAddCase}
                disabled={isRunning}
                className="w-full border border-outline-variant text-primary font-mono text-[10px] tracking-widest uppercase py-3 hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <MaterialIcon name="add" className="text-[14px]" />
                ADD ANOTHER COUNTRY
              </button>

              {/* Run analysis */}
              <button
                onClick={handleRunAnalysis}
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
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    ANALYSING…
                  </>
                ) : (
                  cases.length > 1
                    ? `RUN COMBINED ANALYSIS (${cases.length}) →`
                    : "RUN CONFLICT ANALYSIS →"
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Add-case prompt overlay */}
      {isAddingCase && (
        <div className="fixed inset-0 bg-primary/70 flex items-center justify-center z-[110]">
          <div className="bg-surface w-[420px] border border-outline-variant">
            <div className="px-6 py-5 border-b border-outline-variant">
              <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                ADD EXPANSION PLAN
              </p>
              <h3 className="font-headline text-lg font-bold text-primary">
                Select another country on the map
              </h3>
              <p className="font-body text-sm text-on-surface-variant mt-2">
                Click any country on the map to create a new expansion plan. The plan will use the same default template as your other cases.
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end">
              <button
                onClick={cancelAddCase}
                className="font-mono text-[10px] tracking-widest uppercase border border-outline-variant px-4 py-2 text-outline hover:text-primary transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
