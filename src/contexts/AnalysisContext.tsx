import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useAgentStream, startAnalysis, fetchResult, fetchTwin, confirmTwin } from "@/lib/useAgentStream";
import { AnalysisParams, AnalysisResult, EntityType, ExpansionTwin, PresenceData, AgentEvent } from "@/types";

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

interface AnalysisContextValue {
  presenceData: Record<string, PresenceData>;
  activeCountry: { iso: string; name: string } | null;
  panelOpen: boolean;
  sessionId: string | null;
  result: AnalysisResult | null;
  twin: ExpansionTwin | null;
  showTwinReview: boolean;
  events: AgentEvent[];
  isRunning: boolean;
  isComplete: boolean;
  error: string | null;
  handleCountryClick: (iso: string, name: string) => void;
  handleClose: () => void;
  handleRunAnalysis: (params: AnalysisParams) => Promise<void>;
  confirmTwinAndContinue: () => Promise<void>;
  setShowTwinReview: (v: boolean) => void;
  resetAnalysis: () => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [activeCountry, setActiveCountry] = useState<{ iso: string; name: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
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

  useEffect(() => {
    if (!showTwinReview || !sessionId) return;
    const t = setTimeout(async () => {
      await confirmTwin(sessionId).catch(() => null);
      setShowTwinReview(false);
    }, 5000);
    return () => clearTimeout(t);
  }, [showTwinReview, sessionId]);

  useEffect(() => {
    if (!isComplete || !sessionId) return;
    void (async () => {
      const data = await fetchResult(sessionId).catch(() => null);
      if (data) setResult(data as AnalysisResult);
    })();
  }, [isComplete, sessionId]);

  const confirmTwinAndContinue = useCallback(async () => {
    if (sessionId) await confirmTwin(sessionId, twin ?? undefined).catch(() => null);
    setShowTwinReview(false);
  }, [sessionId, twin]);

  const resetAnalysis = useCallback(() => {
    resetStream();
    setResult(null);
    setTwin(null);
    setShowTwinReview(false);
    setSessionId(null);
    setActiveCountry(null);
    setPanelOpen(false);
  }, [resetStream]);

  return (
    <AnalysisContext.Provider
      value={{
        presenceData,
        activeCountry,
        panelOpen,
        sessionId,
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
        setShowTwinReview,
        resetAnalysis,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
}
