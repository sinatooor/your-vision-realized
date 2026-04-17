import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { WorldMap } from "@/components/Map/WorldMap";
import { JurisdictionPanel } from "@/components/Panel/JurisdictionPanel";
import { AgentStream } from "@/components/Panel/AgentStream";
import { useAnalysis } from "@/contexts/AnalysisContext";

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
    handleCountryClick,
    handleClose,
    handleRunAnalysis,
    confirmTwinAndContinue,
  } = useAnalysis();

  const navigatedRef = useRef(false);
  useEffect(() => {
    if (result && !navigatedRef.current) {
      navigatedRef.current = true;
      navigate("/conflicts");
    }
  }, [result, navigate]);

  return (
    <div className="fixed inset-0 top-[89px] bottom-8">
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
        <div className="fixed right-0 bottom-8 w-[340px] border-l border-t border-outline-variant bg-surface z-50 max-h-64 overflow-y-auto">
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
  );
}
