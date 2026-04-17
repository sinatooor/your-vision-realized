import { useState, useEffect, useCallback } from "react";
import { TopAppBar } from "@/components/TopAppBar";
import { StatusFooter } from "@/components/StatusFooter";
import { WorldMap } from "@/components/Map/WorldMap";
import { JurisdictionPanel } from "@/components/Panel/JurisdictionPanel";
import { AgentStream } from "@/components/Panel/AgentStream";
import { ConflictMap } from "@/components/Results/ConflictMap";
import { ScenarioTable } from "@/components/Results/ScenarioTable";
import { ActionPlan } from "@/components/Results/ActionPlan";
import { MemoExport } from "@/components/Results/MemoExport";
import { useAgentStream, startAnalysis, fetchResult, fetchTwin, confirmTwin } from "@/lib/useAgentStream";
import { AnalysisParams, AnalysisResult, EntityType, ExpansionTwin, PresenceData } from "@/types";

type View = "map" | "conflicts" | "scenarios" | "plan" | "memo";

const INITIAL_PRESENCE: Record<string, PresenceData> = {
  SE: { employees: 2, entityType: "hq" as EntityType },
  DE: { employees: 3, entityType: "eor" as EntityType },
  SG: { employees: 1, entityType: "contractor" as EntityType },
  GB: { employees: 2, entityType: "eor" as EntityType },
};

const COMPANY_NAME = "NordHR Technologies AB";
const COMPANY_INDUSTRY = "HR SaaS";

function buildBrief(country: string, countryName: string, params: AnalysisParams): string {
  const dataDesc =
    params.dataType === "hr-only"
      ? "HR data (employee records, payroll, performance data)"
      : params.dataType === "personal"
      ? "personal and customer data"
      : "no personal data";
  return `${COMPANY_NAME} is a ${COMPANY_INDUSTRY} company headquartered in Sweden (SE) with approximately 50 employees globally. They are expanding to ${countryName} (${country}) and plan to hire ${params.targetHeadcount} employees on a ${params.arrangement} basis using ${params.entityStructure} structure. They process ${dataDesc}. Their data architecture is centralised in Sweden. Target launch: ${params.startDate || "Q2 2025"}. Current Germany employees: 3 (EOR). Current Singapore employees: 1 (contractor). Current UK employees: 2 (EOR). The company has AI features in their HR analytics product.`;
}

export default function Index() {
  const [activeCountry, setActiveCountry] = useState<{ iso: string; name: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [view, setView] = useState<View>("map");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [twin, setTwin] = useState<ExpansionTwin | null>(null);
  const [showTwinReview, setShowTwinReview] = useState(false);
  const [presenceData] = useState(INITIAL_PRESENCE);

  const { events, isRunning, isComplete, error, start: startStream, reset: resetStream } = useAgentStream();

  const handleCountryClick = useCallback((iso: string, name: string) => {
    setActiveCountry({ iso, name });
    setPanelOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setPanelOpen(false);
    setActiveCountry(null);
  }, []);

  const handleRunAnalysis = useCallback(
    async (params: AnalysisParams) => {
      if (!activeCountry) return;
      resetStream();
      setResult(null);
      setTwin(null);
      setShowTwinReview(false);

      try {
        const brief = buildBrief(activeCountry.iso, activeCountry.name, params);
        const sid = await startAnalysis(brief);
        setSessionId(sid);
        startStream(sid);
      } catch (err) {
        console.error("Failed to start analysis:", err);
      }
    },
    [activeCountry, resetStream, startStream],
  );

  // Poll for twin after intake completes
  useEffect(() => {
    if (!sessionId || !isRunning) return;
    const hasTwinEvent = events.some(
      (e) => e.type === "agent_complete" && e.agent.includes("Intake"),
    );
    if (!hasTwinEvent) return;

    void (async () => {
      const data = await fetchTwin(sessionId).catch(() => null);
      if (data?.twin && !data.confirmed) {
        setTwin(data.twin as ExpansionTwin);
        setShowTwinReview(true);
      }
    })();
  }, [events, sessionId, isRunning]);

  // Auto-confirm twin after 5 seconds
  useEffect(() => {
    if (!showTwinReview || !sessionId) return;
    const t = setTimeout(async () => {
      await confirmTwin(sessionId).catch(() => null);
      setShowTwinReview(false);
    }, 5000);
    return () => clearTimeout(t);
  }, [showTwinReview, sessionId]);

  // Fetch result when stream completes
  useEffect(() => {
    if (!isComplete || !sessionId) return;
    void (async () => {
      const data = await fetchResult(sessionId).catch(() => null);
      if (data) {
        setResult(data as AnalysisResult);
        setView("conflicts");
      }
    })();
  }, [isComplete, sessionId]);

  const tabs: Array<{ key: View; label: string; count?: number }> = [
    { key: "map", label: "MAP" },
    { key: "conflicts", label: "CONFLICTS", count: result?.conflicts.length },
    { key: "scenarios", label: "SCENARIOS" },
    { key: "plan", label: "ACTION PLAN", count: result?.actions.length },
    { key: "memo", label: "MEMO" },
  ];

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col overflow-hidden">
      <TopAppBar />

      {/* Results nav tabs */}
      {result && (
        <div className="fixed top-[89px] left-0 right-0 z-40 bg-surface border-b border-outline-variant flex items-center px-12 gap-1 h-10">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`font-mono text-[10px] tracking-widest uppercase px-4 h-full transition-colors flex items-center gap-2 ${
                view === tab.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-outline hover:text-primary"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 ${
                    view === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-highest text-on-surface"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <main
        className={`flex-1 ${result ? "pt-[129px]" : "pt-[89px]"} pb-8 overflow-auto`}
        style={{ height: "calc(100vh - 32px)" }}
      >
        {/* MAP VIEW */}
        {view === "map" && (
          <div className="relative w-full h-full">
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

            {/* Agent stream below panel */}
            {panelOpen && (events.length > 0 || isRunning) && (
              <div className="fixed right-0 bottom-8 w-[340px] border-l border-t border-outline-variant bg-surface z-50 max-h-64 overflow-y-auto">
                <AgentStream events={events} isRunning={isRunning} isComplete={isComplete} />
              </div>
            )}

            {/* Twin review modal */}
            {showTwinReview && twin && (
              <div className="fixed inset-0 bg-primary/70 flex items-center justify-center z-[100]">
                <div className="bg-surface w-[480px] border border-outline-variant">
                  <div className="px-6 py-5 border-b border-outline-variant">
                    <h2 className="font-headline text-xl font-bold text-primary">
                      Review Expansion Twin
                    </h2>
                    <p className="font-mono text-[9px] tracking-widest uppercase text-outline mt-1">
                      Auto-confirming in 5 seconds
                    </p>
                  </div>
                  <div className="px-6 py-4 grid grid-cols-2 gap-4 mb-2">
                    {[
                      { label: "COMPANY", value: twin.company?.name },
                      { label: "HQ", value: twin.company?.hqCountry },
                      { label: "TARGETS", value: twin.expansion?.targetCountries.join(", ") },
                      { label: "DATA", value: twin.data?.categories.join(", ") },
                      { label: "HIRES", value: JSON.stringify(twin.people?.hiresByCountry) },
                      { label: "CENTRALISED", value: String(twin.data?.centralised) },
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
                      onClick={async () => {
                        if (sessionId) await confirmTwin(sessionId, twin).catch(() => null);
                        setShowTwinReview(false);
                      }}
                      className="w-full bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase py-3 hover:bg-primary/90"
                    >
                      CONFIRM & CONTINUE ANALYSIS →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error toast */}
            {error && (
              <div className="fixed bottom-12 right-4 bg-critical text-critical-foreground font-mono text-[10px] tracking-widest uppercase px-4 py-2 z-50 max-w-xs">
                ✗ {error}
              </div>
            )}
          </div>
        )}

        {/* RESULTS VIEWS */}
        {view !== "map" && result && (
          <div className="px-12 py-8 max-w-5xl">
            {view === "conflicts" && (
              <ConflictMap conflicts={result.conflicts} obligations={result.obligations} />
            )}
            {view === "scenarios" && <ScenarioTable scenarios={result.scenarios} />}
            {view === "plan" && <ActionPlan actions={result.actions} />}
            {view === "memo" && (
              <MemoExport
                memo={{
                  executiveSummary: result.executiveSummary,
                  memoMarkdown: result.memoMarkdown,
                }}
              />
            )}
          </div>
        )}

        {view !== "map" && !result && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="font-mono text-[10px] tracking-widest uppercase text-outline mb-4">
                NO ANALYSIS RESULTS YET
              </p>
              <button
                onClick={() => setView("map")}
                className="font-mono text-[10px] tracking-widest uppercase border border-primary text-primary px-5 py-2.5 hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                RETURN TO MAP →
              </button>
            </div>
          </div>
        )}
      </main>

      <StatusFooter />
    </div>
  );
}
