import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from "react";
import { useAgentStream, startAnalysis, fetchResult, fetchTwin, confirmTwin } from "@/lib/useAgentStream";
import { AnalysisParams, AnalysisResult, EntityType, ExpansionTwin, PresenceData, AgentEvent } from "@/types";
import { useCompany } from "@/contexts/CompanyContext";
import type { CompanyProfile, FootprintEntry, DataArchitecture } from "@/contexts/CompanyContext";

function mapEntityType(label: string): EntityType {
  const s = label.toLowerCase();
  if (s.includes("headquarter") || s === "hq") return "hq";
  if (s.includes("employer of record") || s.includes("eor")) return "eor";
  if (s.includes("contractor")) return "contractor";
  if (s.includes("branch")) return "branch";
  if (s.includes("subsidiary")) return "subsidiary";
  if (s.includes("representative")) return "representative";
  return "eor";
}

function buildBrief(
  country: string,
  countryName: string,
  params: AnalysisParams,
  company: CompanyProfile,
  footprint: FootprintEntry[],
  dataArch: DataArchitecture,
): string {
  const hqIso = company.hqCountry.match(/\(([A-Z]+)\)/)?.[1] ?? "SE";
  const globalHeadcount = footprint.reduce((s, r) => s + r.headcount, 0);
  const currentPresence = footprint
    .filter((r) => r.iso !== hqIso)
    .map((r) => `${r.iso}: ${r.headcount} (${mapEntityType(r.entityType)})`)
    .join(", ");
  const dataDesc =
    params.dataType === "hr-only"
      ? "HR data (employee records, payroll, performance data)"
      : params.dataType === "personal"
      ? "personal and customer data"
      : "no personal data";
  const aiNote =
    company.hasAiFeatures || params.hasAiFeatures
      ? " Their product includes AI/ML features subject to AI Act obligations."
      : "";
  const storageNote = dataArch.centralized
    ? `centralised in ${dataArch.storageJurisdiction}`
    : `distributed across ${dataArch.storageJurisdiction}`;
  return `${company.name} is a ${company.industry} company headquartered in ${company.hqCountry} with approximately ${globalHeadcount} employees globally and annual revenue of ${company.revenue}. They are expanding to ${countryName} (${country}) and plan to hire ${params.targetHeadcount} employees on a ${params.arrangement} basis using ${params.entityStructure} structure. They process ${dataDesc}. Their data architecture is ${storageNote}. Target launch: ${params.startDate || "Q2 2025"}. Current international presence — ${currentPresence}.${aiNote}`;
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
  const { company, footprint, dataArch } = useCompany();

  const presenceData = useMemo<Record<string, PresenceData>>(() => {
    const map: Record<string, PresenceData> = {};
    for (const row of footprint) {
      map[row.iso] = { employees: row.headcount, entityType: mapEntityType(row.entityType) };
    }
    return map;
  }, [footprint]);

  const [activeCountry, setActiveCountry] = useState<{ iso: string; name: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [twin, setTwin] = useState<ExpansionTwin | null>(null);
  const [showTwinReview, setShowTwinReview] = useState(false);
  const [hasNavigatedToResults, setHasNavigatedToResults] = useState(false);

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
        const brief = buildBrief(activeCountry.iso, activeCountry.name, params, company, footprint, dataArch);
        const sid = await startAnalysis(brief);
        setSessionId(sid);
        startStream(sid);
      } catch (err) {
        console.error("Failed to start analysis:", err);
      }
    },
    [activeCountry, resetStream, startStream, company, footprint, dataArch],
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
