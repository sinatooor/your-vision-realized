import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useAgentStream, startAnalysis, fetchResult, fetchTwin, confirmTwin } from "@/lib/useAgentStream";
import { AnalysisParams, AnalysisResult, EntityType, ExpansionTwin, PresenceData, AgentEvent } from "@/types";

const INITIAL_PRESENCE: Record<string, PresenceData> = {
  SE: { employees: 185, entityType: "hq" as EntityType },
  DE: { employees: 48, entityType: "eor" as EntityType },
  SG: { employees: 12, entityType: "contractor" as EntityType },
  GB: { employees: 34, entityType: "eor" as EntityType },
};

const COMPANY_NAME = "NordHR Technologies AB";
const GLOBAL_HEADCOUNT = Object.values(INITIAL_PRESENCE).reduce((sum, p) => sum + p.employees, 0);

const INDUSTRY_LABELS: Record<string, string> = {
  "hr-saas": "HR / HCM SaaS",
  fintech: "Fintech / Payments",
  biomedical: "Biomedical / Pharma",
  manufacturing: "Manufacturing",
  "e-commerce": "E-Commerce / Retail",
  logistics: "Logistics / Supply Chain",
  legaltech: "LegalTech",
  other: "Technology",
};

const REVENUE_LABELS: Record<string, string> = {
  "under-1m": "under €1 M",
  "1m-10m": "€1 M – €10 M",
  "10m-100m": "€10 M – €100 M",
  "over-100m": "over €100 M",
};

function buildBrief(country: string, countryName: string, params: AnalysisParams): string {
  const dataDesc =
    params.dataType === "hr-only"
      ? "HR data (employee records, payroll, performance data)"
      : params.dataType === "personal"
      ? "personal and customer data"
      : "no personal data";
  const currentPresence = Object.entries(INITIAL_PRESENCE)
    .filter(([iso]) => iso !== "SE")
    .map(([iso, p]) => `${iso}: ${p.employees} (${p.entityType})`)
    .join(", ");
  const industryLabel = INDUSTRY_LABELS[params.industry] ?? "Technology";
  const aiNote = params.hasAiFeatures ? " Their product includes AI/ML features subject to AI Act obligations." : "";
  return `${COMPANY_NAME} is a ${industryLabel} company headquartered in Sweden (SE) with approximately ${GLOBAL_HEADCOUNT} employees globally and annual revenue of ${REVENUE_LABELS[params.revenueEur] ?? "undisclosed"}. They are expanding to ${countryName} (${country}) and plan to hire ${params.targetHeadcount} employees on a ${params.arrangement} basis using ${params.entityStructure} structure. They process ${dataDesc}. Their data architecture is centralised in Sweden. Target launch: ${params.startDate || "Q2 2025"}. Current international presence — ${currentPresence}.${aiNote}`;
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
  hasNavigatedToResults: boolean;
  markNavigatedToResults: () => void;
  handleCountryClick: (iso: string, name: string) => void;
  handleClose: () => void;
  handleRunAnalysis: (params: AnalysisParams) => Promise<void>;
  confirmTwinAndContinue: () => Promise<void>;
  setShowTwinReview: (v: boolean) => void;
  resetAnalysis: () => void;
  updateMemo: (patch: { memoMarkdown?: string; executiveSummary?: string }) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [activeCountry, setActiveCountry] = useState<{ iso: string; name: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [twin, setTwin] = useState<ExpansionTwin | null>(null);
  const [showTwinReview, setShowTwinReview] = useState(false);
  const [hasNavigatedToResults, setHasNavigatedToResults] = useState(false);
  const [presenceData] = useState(INITIAL_PRESENCE);

  const markNavigatedToResults = useCallback(() => setHasNavigatedToResults(true), []);

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
      setHasNavigatedToResults(false);
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

  const updateMemo = useCallback(
    (patch: { memoMarkdown?: string; executiveSummary?: string }) => {
      setResult((prev) =>
        prev
          ? {
              ...prev,
              memoMarkdown: patch.memoMarkdown ?? prev.memoMarkdown,
              executiveSummary: patch.executiveSummary ?? prev.executiveSummary,
            }
          : prev,
      );
    },
    [],
  );

  const resetAnalysis = useCallback(() => {
    resetStream();
    setResult(null);
    setTwin(null);
    setShowTwinReview(false);
    setSessionId(null);
    setActiveCountry(null);
    setPanelOpen(false);
    setHasNavigatedToResults(false);
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
        hasNavigatedToResults,
        markNavigatedToResults,
        handleCountryClick,
        handleClose,
        handleRunAnalysis,
        confirmTwinAndContinue,
        setShowTwinReview,
        resetAnalysis,
        updateMemo,
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
