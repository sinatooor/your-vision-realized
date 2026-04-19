import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from "react";
import { useAgentStream, startAnalysis, startDemoAnalysis, fetchResult, fetchTwin, confirmTwin } from "@/lib/useAgentStream";
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

export interface ExpansionCase {
  id: string;
  iso: string;
  name: string;
  params: AnalysisParams;
}

export const DEFAULT_CASE_PARAMS: AnalysisParams = {
  targetHeadcount: 3,
  arrangement: "remote",
  entityStructure: "eor",
  startDate: "",
  dataType: "hr-only",
  industry: "hr-saas",
  revenueEur: "1m-10m",
  hasAiFeatures: false,
};

function describeCase(
  c: ExpansionCase,
  index: number,
  total: number,
): string {
  const dataDesc =
    c.params.dataType === "hr-only"
      ? "HR data (employee records, payroll, performance)"
      : c.params.dataType === "personal"
      ? "personal and customer data"
      : "no personal data";
  return `Plan ${index + 1} of ${total} — ${c.name} (${c.iso}): hire ${c.params.targetHeadcount} employees on a ${c.params.arrangement} basis using ${c.params.entityStructure} structure, processing ${dataDesc}, target launch ${c.params.startDate || "unspecified"}.`;
}

function buildMultiCaseBrief(
  cases: ExpansionCase[],
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
  const aiNote =
    company.hasAiFeatures || cases.some((c) => c.params.hasAiFeatures)
      ? " Their product includes AI/ML features subject to AI Act obligations."
      : "";
  const storageNote = dataArch.centralized
    ? `centralised in ${dataArch.storageJurisdiction}`
    : `distributed across ${dataArch.storageJurisdiction}`;

  const planLines = cases.map((c, i) => describeCase(c, i, cases.length)).join("\n");
  const targets = cases.map((c) => `${c.name} (${c.iso})`).join(", ");

  const crossNote =
    cases.length > 1
      ? ` IMPORTANT: Analyse all ${cases.length} expansion plans together as a single combined programme. Surface cross-jurisdiction interactions, dependencies, and conflicts BETWEEN the plans (e.g. tax exposure triggered in one country by activity in another, data transfers between target countries, sanctions or licensing rules that interact across borders, headcount thresholds that aggregate globally). Recommend an action plan that sequences and reconciles all plans, not country-by-country in isolation.`
      : "";

  return `${company.name} is a ${company.industry} company headquartered in ${company.hqCountry} with approximately ${globalHeadcount} employees globally and annual revenue of ${company.revenue}. Their data architecture is ${storageNote}. Current international presence — ${currentPresence}.${aiNote}

They are planning a combined cross-border expansion into: ${targets}.

${planLines}${crossNote}`;
}

interface AnalysisContextValue {
  presenceData: Record<string, PresenceData>;
  activeCountry: { iso: string; name: string } | null;
  panelOpen: boolean;
  cases: ExpansionCase[];
  activeCaseId: string | null;
  isAddingCase: boolean;
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
  handleRunAnalysis: () => Promise<void>;
  updateCaseParams: (caseId: string, patch: Partial<AnalysisParams>) => void;
  removeCase: (caseId: string) => void;
  setActiveCaseId: (caseId: string) => void;
  beginAddCase: () => void;
  cancelAddCase: () => void;
  confirmTwinAndContinue: () => Promise<void>;
  setShowTwinReview: (v: boolean) => void;
  resetAnalysis: () => void;
  updateMemo: (patch: { memoMarkdown?: string; executiveSummary?: string }) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

function makeCaseId() {
  return `case_${Math.random().toString(36).slice(2, 10)}`;
}

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
  const [cases, setCases] = useState<ExpansionCase[]>([]);
  const [activeCaseId, setActiveCaseIdState] = useState<string | null>(null);
  const [isAddingCase, setIsAddingCase] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [twin, setTwin] = useState<ExpansionTwin | null>(null);
  const [showTwinReview, setShowTwinReview] = useState(false);
  const [hasNavigatedToResults, setHasNavigatedToResults] = useState(false);

  const markNavigatedToResults = useCallback(() => setHasNavigatedToResults(true), []);

  const { events, isRunning, isComplete, error, start: startStream, reset: resetStream } = useAgentStream();

  const handleCountryClick = useCallback((iso: string, name: string) => {
    setCases((prev) => {
      // If case already exists for this country, just focus it.
      const existing = prev.find((c) => c.iso === iso);
      if (existing) {
        setActiveCaseIdState(existing.id);
        setActiveCountry({ iso, name });
        setPanelOpen(true);
        setIsAddingCase(false);
        return prev;
      }

      // If adding a new case, append. Otherwise replace single case with first selection.
      if (prev.length === 0 || isAddingCase) {
        const newCase: ExpansionCase = {
          id: makeCaseId(),
          iso,
          name,
          params: { ...DEFAULT_CASE_PARAMS },
        };
        setActiveCaseIdState(newCase.id);
        setActiveCountry({ iso, name });
        setPanelOpen(true);
        setIsAddingCase(false);
        return [...prev, newCase];
      }

      // Default: replace the only case (preserve multi-case mode if user already has >1).
      const newCase: ExpansionCase = {
        id: makeCaseId(),
        iso,
        name,
        params: { ...DEFAULT_CASE_PARAMS },
      };
      setActiveCaseIdState(newCase.id);
      setActiveCountry({ iso, name });
      setPanelOpen(true);
      return [newCase];
    });
  }, [isAddingCase]);

  const handleClose = useCallback(() => {
    setPanelOpen(false);
    setActiveCountry(null);
    setActiveCaseIdState(null);
    setIsAddingCase(false);
    setCases([]);
  }, []);

  const updateCaseParams = useCallback((caseId: string, patch: Partial<AnalysisParams>) => {
    setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, params: { ...c.params, ...patch } } : c)));
  }, []);

  const removeCase = useCallback((caseId: string) => {
    setCases((prev) => {
      const next = prev.filter((c) => c.id !== caseId);
      if (next.length === 0) {
        setPanelOpen(false);
        setActiveCountry(null);
        setActiveCaseIdState(null);
        setIsAddingCase(false);
        return next;
      }
      // If the removed one was active, pick the last one.
      setActiveCaseIdState((curr) => {
        if (curr !== caseId) return curr;
        const fallback = next[next.length - 1];
        setActiveCountry({ iso: fallback.iso, name: fallback.name });
        return fallback.id;
      });
      return next;
    });
  }, []);

  const setActiveCaseId = useCallback((caseId: string) => {
    setCases((prev) => {
      const found = prev.find((c) => c.id === caseId);
      if (found) {
        setActiveCaseIdState(caseId);
        setActiveCountry({ iso: found.iso, name: found.name });
      }
      return prev;
    });
  }, []);

  const beginAddCase = useCallback(() => setIsAddingCase(true), []);
  const cancelAddCase = useCallback(() => setIsAddingCase(false), []);

  const handleRunAnalysis = useCallback(async () => {
    if (cases.length === 0) return;
    resetStream();
    setResult(null);
    setTwin(null);
    setShowTwinReview(false);
    setHasNavigatedToResults(false);
    try {
      let sid: string;
      // Demo path only for single-country DE selection (preserves existing demo flow).
      if (cases.length === 1 && cases[0].iso === "DE") {
        sid = await startDemoAnalysis();
      } else {
        const brief = buildMultiCaseBrief(cases, company, footprint, dataArch);
        sid = await startAnalysis(brief);
      }
      setSessionId(sid);
      startStream(sid);
    } catch (err) {
      console.error("Failed to start analysis:", err);
    }
  }, [cases, resetStream, startStream, company, footprint, dataArch]);

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
    setCases([]);
    setActiveCaseIdState(null);
    setIsAddingCase(false);
    setHasNavigatedToResults(false);
  }, [resetStream]);

  return (
    <AnalysisContext.Provider
      value={{
        presenceData,
        activeCountry,
        panelOpen,
        cases,
        activeCaseId,
        isAddingCase,
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
        updateCaseParams,
        removeCase,
        setActiveCaseId,
        beginAddCase,
        cancelAddCase,
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
