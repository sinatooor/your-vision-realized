import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WorldMap } from "@/components/Map/WorldMap";
import { JurisdictionPanel } from "@/components/Panel/JurisdictionPanel";
import { AgentStream } from "@/components/Panel/AgentStream";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useAnalysis } from "@/contexts/AnalysisContext";

const REGULATORY_FRAMEWORKS = [
  { code: "GDPR", name: "EU General Data Protection Regulation", scope: "EU/EEA", risk: "high" },
  { code: "PDPA", name: "Personal Data Protection Act", scope: "Singapore", risk: "medium" },
  { code: "PIPL", name: "Personal Information Protection Law", scope: "China", risk: "high" },
  { code: "CCPA", name: "California Consumer Privacy Act", scope: "California, USA", risk: "medium" },
  { code: "LGPD", name: "Lei Geral de Proteção de Dados", scope: "Brazil", risk: "medium" },
  { code: "UK-GDPR", name: "UK General Data Protection Regulation", scope: "United Kingdom", risk: "high" },
];

const TAX_EXPOSURES = [
  { jurisdiction: "Sweden (SE)", type: "Corporate Income Tax", rate: "20.6%", exposure: "high" },
  { jurisdiction: "Germany (DE)", type: "Trade Tax + CIT", rate: "~30%", exposure: "high" },
  { jurisdiction: "United Kingdom (GB)", type: "Corporation Tax", rate: "25%", exposure: "medium" },
  { jurisdiction: "Singapore (SG)", type: "Corporate Income Tax", rate: "17%", exposure: "low" },
  { jurisdiction: "Vietnam (VN)", type: "Corporate Income Tax", rate: "20%", exposure: "medium" },
];

const ENTITY_OPTIONS = [
  {
    name: "Employer of Record (EOR)",
    setupTime: "1–2 weeks",
    cost: "Low",
    risk: "Low",
    note: "Fastest path to hire — third party employs on your behalf.",
  },
  {
    name: "Wholly-Owned Subsidiary",
    setupTime: "2–4 months",
    cost: "High",
    risk: "Medium",
    note: "Full control, ideal for long-term presence and IP holding.",
  },
  {
    name: "Branch Office",
    setupTime: "1–3 months",
    cost: "Medium",
    risk: "Medium",
    note: "Permanent establishment risk — parent liability extends.",
  },
  {
    name: "Contractor Engagement",
    setupTime: "Days",
    cost: "Very Low",
    risk: "High",
    note: "Misclassification risk in most jurisdictions — short-term only.",
  },
];

const riskColor = (level: string) => {
  if (level === "high") return "text-critical border-critical";
  if (level === "medium") return "text-medium border-medium";
  return "text-low border-low";
};

export default function Overview() {
  const navigate = useNavigate();
  const {
    presenceData,
    activeCountry,
    panelOpen,
    result,
    twin,
    showTwinReview,
    events,
    isRunning,
    isComplete,
    error,
    hasNavigatedToResults,
    markNavigatedToResults,
    handleCountryClick,
    handleClose,
    handleRunAnalysis,
    confirmTwinAndContinue,
  } = useAnalysis();

  useEffect(() => {
    if (result && !hasNavigatedToResults) {
      markNavigatedToResults();
      navigate("/conflicts");
    }
  }, [result, hasNavigatedToResults, markNavigatedToResults, navigate]);

  return (
    <main
      className="flex-1 pt-[89px] pb-8 overflow-auto"
      style={{ height: "calc(100vh - 32px)" }}
    >
      {/* REGION SELECT — Map */}
      <section id="region-select" className="relative h-[calc(100vh-121px)] border-b border-outline-variant">
        <div className="absolute inset-0">
          <WorldMap
            presenceData={presenceData}
            onCountryClick={handleCountryClick}
            activeCountry={activeCountry?.iso ?? null}
            panelOpen={panelOpen}
          />

          <JurisdictionPanel
            country={activeCountry}
            presence={activeCountry ? (presenceData[activeCountry.iso] ?? null) : null}
            onClose={handleClose}
            onRunAnalysis={handleRunAnalysis}
            isRunning={isRunning}
          />

          {panelOpen && (events.length > 0 || isRunning) && (
            <div className="absolute right-0 bottom-0 w-[340px] border-l border-t border-outline-variant bg-surface z-50 max-h-64 overflow-y-auto">
              <AgentStream events={events} isRunning={isRunning} isComplete={isComplete} />
            </div>
          )}

          {showTwinReview && twin && (
            <div className="fixed inset-0 bg-primary/70 flex items-center justify-center z-[100]">
              <div className="bg-surface w-[480px] border border-outline-variant">
                <div className="px-6 py-5 border-b border-outline-variant">
                  <h2 className="font-headline text-xl font-bold text-primary">
                    Review Expansion Profile
                  </h2>
                  <p className="font-mono text-[9px] tracking-widest uppercase text-outline mt-1">
                    Auto-confirming in 5 seconds — or confirm now to proceed
                  </p>
                </div>
                <div className="px-6 py-4 grid grid-cols-2 gap-4 mb-2">
                  {[
                    { label: "COMPANY", value: twin.company?.name },
                    { label: "HQ JURISDICTION", value: twin.company?.hqCountry },
                    { label: "TARGET COUNTRIES", value: twin.expansion?.targetCountries.join(", ") },
                    { label: "DATA CATEGORIES", value: twin.data?.categories.join(", ") },
                    { label: "HEADCOUNT BY COUNTRY", value: JSON.stringify(twin.people?.hiresByCountry) },
                    { label: "CENTRALISED DATA", value: String(twin.data?.centralised) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-0.5">
                        {label}
                      </p>
                      <p className="font-body text-sm text-primary font-bold truncate">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="px-6 pb-5">
                  <button
                    onClick={confirmTwinAndContinue}
                    className="w-full bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase py-3 hover:bg-primary/90"
                  >
                    CONFIRM & CONTINUE ANALYSIS →
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="fixed bottom-12 right-4 bg-critical text-critical-foreground font-mono text-[10px] tracking-widest uppercase px-4 py-2 z-50 max-w-xs">
              ✗ {error}
            </div>
          )}
        </div>
      </section>

      {/* REGULATORY SCOPE */}
      <section id="regulatory-scope" className="px-12 py-16 max-w-5xl">
        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-2">
            Section 02
          </p>
          <h2 className="font-headline text-3xl font-bold text-primary">Regulatory Scope</h2>
          <p className="font-body text-sm text-on-surface-variant mt-2 max-w-xl">
            Applicable cross-border regulatory frameworks across the client's current and target jurisdictions.
          </p>
        </div>
        <div className="border border-outline-variant divide-y divide-outline-variant">
          {REGULATORY_FRAMEWORKS.map((f) => (
            <div key={f.code} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <MaterialIcon name="gavel" className="text-[20px] text-outline shrink-0" />
                <div className="min-w-0">
                  <p className="font-body text-sm text-primary font-medium">{f.name}</p>
                  <p className="font-mono text-[9px] tracking-widest uppercase text-outline mt-0.5">
                    {f.code} · {f.scope}
                  </p>
                </div>
              </div>
              <span
                className={`font-mono text-[9px] tracking-widest uppercase border px-2.5 py-1 shrink-0 ${riskColor(f.risk)}`}
              >
                {f.risk} risk
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* TAX EXPOSURE */}
      <section id="tax-exposure" className="px-12 py-16 max-w-5xl border-t border-outline-variant">
        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-2">
            Section 03
          </p>
          <h2 className="font-headline text-3xl font-bold text-primary">Tax Exposure</h2>
          <p className="font-body text-sm text-on-surface-variant mt-2 max-w-xl">
            Estimated corporate tax liability and permanent-establishment exposure across each jurisdiction with active presence.
          </p>
        </div>
        <div className="border border-outline-variant">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-surface-container border-b border-outline-variant">
            <p className="col-span-5 font-mono text-[9px] tracking-widest uppercase text-outline">
              Jurisdiction
            </p>
            <p className="col-span-4 font-mono text-[9px] tracking-widest uppercase text-outline">
              Type
            </p>
            <p className="col-span-2 font-mono text-[9px] tracking-widest uppercase text-outline">
              Rate
            </p>
            <p className="col-span-1 font-mono text-[9px] tracking-widest uppercase text-outline text-right">
              Exposure
            </p>
          </div>
          <div className="divide-y divide-outline-variant">
            {TAX_EXPOSURES.map((t) => (
              <div key={t.jurisdiction} className="grid grid-cols-12 gap-4 px-5 py-4 items-center">
                <p className="col-span-5 font-body text-sm text-primary font-medium">
                  {t.jurisdiction}
                </p>
                <p className="col-span-4 font-body text-sm text-on-surface-variant">{t.type}</p>
                <p className="col-span-2 font-mono text-xs text-primary">{t.rate}</p>
                <div className="col-span-1 flex justify-end">
                  <span
                    className={`font-mono text-[9px] tracking-widest uppercase border px-2 py-0.5 ${riskColor(t.exposure)}`}
                  >
                    {t.exposure}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ENTITY STRUCTURE */}
      <section id="entity-structure" className="px-12 py-16 max-w-5xl border-t border-outline-variant">
        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-2">
            Section 04
          </p>
          <h2 className="font-headline text-3xl font-bold text-primary">Entity Structure</h2>
          <p className="font-body text-sm text-on-surface-variant mt-2 max-w-xl">
            Available legal vehicles for establishing presence in target jurisdictions, with comparative trade-offs.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ENTITY_OPTIONS.map((e) => (
            <div key={e.name} className="border border-outline-variant p-5">
              <div className="flex items-start gap-3 mb-3">
                <MaterialIcon name="account_tree" className="text-[20px] text-primary shrink-0 mt-0.5" />
                <h3 className="font-headline text-lg font-bold text-primary">{e.name}</h3>
              </div>
              <p className="font-body text-sm text-on-surface-variant mb-4">{e.note}</p>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-outline-variant">
                <div>
                  <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                    Setup
                  </p>
                  <p className="font-body text-sm text-primary font-medium">{e.setupTime}</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                    Cost
                  </p>
                  <p className="font-body text-sm text-primary font-medium">{e.cost}</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                    Risk
                  </p>
                  <p className="font-body text-sm text-primary font-medium">{e.risk}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="h-32" />
      </section>
    </main>
  );
}
