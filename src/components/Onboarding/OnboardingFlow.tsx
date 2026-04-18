import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/MaterialIcon";

const STORAGE_KEY = "jurisdictiq.onboarded.v1";

type Stage = {
  id: string;
  badge: string;
  title: string;
  blurb: string;
  body: React.ReactNode;
};

const STAGES: Stage[] = [
  {
    id: "welcome",
    badge: "Stage 01 / 04",
    title: "Cross-border expansion, decoded.",
    blurb:
      "JurisdictIQ is your sovereign ledger for international expansion — turning fragmented legal, tax, and employment rules into a single, signed advisory memo.",
    body: (
      <ul className="space-y-3">
        {[
          "Live regulatory intelligence across 30+ jurisdictions",
          "Conflict detection between HQ and target country rules",
          "Lawyer-grade memo, exportable as PDF or DOCX",
        ].map((line) => (
          <li
            key={line}
            className="flex items-start gap-3 font-body text-sm text-on-surface"
          >
            <span className="font-mono text-[10px] tracking-widest text-outline mt-1">
              ―
            </span>
            {line}
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: "footprint",
    badge: "Stage 02 / 04",
    title: "Map your footprint.",
    blurb:
      "Click any country on the world map to declare your presence — entity type, headcount, and arrangement. Then pick a target jurisdiction to expand into.",
    body: (
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "HQ", value: "SE" },
          { label: "EOR", value: "DE · GB" },
          { label: "TARGET", value: "??" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="border border-outline-variant px-4 py-3 bg-surface-container-low"
          >
            <p className="font-mono text-[9px] tracking-widest uppercase text-outline">
              {label}
            </p>
            <p className="font-headline text-2xl font-bold text-primary mt-1">
              {value}
            </p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "agents",
    badge: "Stage 03 / 04",
    title: "Seven agents, one verdict.",
    blurb:
      "Hit ‘Run Conflict Analysis’ and our agent pipeline crawls statutes, official registries, and the latest regulatory news to surface every conflict that matters.",
    body: (
      <ol className="divide-y divide-outline-variant border border-outline-variant">
        {[
          ["01", "Intake", "Structure the brief"],
          ["02", "Scout", "Fetch live obligations & news"],
          ["03", "Conflicts", "Detect HQ ↔ target tension"],
          ["04", "Scenarios", "Model expansion paths"],
          ["05", "Planner", "Sequence concrete actions"],
          ["06", "Memo", "Draft the advisory"],
        ].map(([n, name, desc]) => (
          <li
            key={n}
            className="flex items-center gap-4 px-4 py-2.5"
          >
            <span className="font-mono text-[10px] tracking-widest text-outline w-6">
              {n}
            </span>
            <span className="font-body text-sm font-medium text-primary w-24">
              {name}
            </span>
            <span className="font-body text-sm text-on-surface-variant">
              {desc}
            </span>
          </li>
        ))}
      </ol>
    ),
  },
  {
    id: "memo",
    badge: "Stage 04 / 04",
    title: "Sign, seal, deliver.",
    blurb:
      "Edit the memo inline, draw your signature, and export a branded PDF or DOCX ready for the partner’s desk and the client’s board.",
    body: (
      <div className="border border-outline-variant bg-surface-container-low p-6">
        <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-2">
          Approved & Signed Off
        </p>
        <p className="font-headline italic text-xl text-primary border-b border-primary pb-3 mb-3">
          ~ Counsel signature
        </p>
        <div className="flex items-center justify-between">
          <p className="font-body text-sm text-on-surface">A. Lindqvist · Partner</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] tracking-widest uppercase border border-outline-variant px-2 py-1">
              PDF
            </span>
            <span className="font-mono text-[9px] tracking-widest uppercase border border-outline-variant px-2 py-1">
              DOCX
            </span>
          </div>
        </div>
      </div>
    ),
  },
];

export function OnboardingFlow() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* noop */
    }
    setOpen(false);
  };

  if (!open) return null;

  const stage = STAGES[step];
  const isLast = step === STAGES.length - 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-primary/70 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="w-[640px] max-w-[92vw] bg-surface border border-outline-variant ledger-shadow">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-outline-variant">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline">
            {stage.badge}
          </p>
          <button
            onClick={dismiss}
            className="font-mono text-[9px] tracking-widest uppercase text-outline hover:text-primary transition-colors flex items-center gap-1"
            aria-label="Skip onboarding"
          >
            Skip
            <MaterialIcon name="close" className="text-[14px]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-7">
          <h2
            id="onboarding-title"
            className="font-headline text-3xl font-bold text-primary leading-tight"
          >
            {stage.title}
          </h2>
          <p className="font-body text-sm text-on-surface-variant mt-3 mb-6 max-w-lg">
            {stage.blurb}
          </p>
          <div className="min-h-[180px]">{stage.body}</div>
        </div>

        {/* Stage indicator */}
        <div className="px-7 pb-2 flex items-center gap-2">
          {STAGES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              aria-label={`Go to ${s.badge}`}
              className={`h-[3px] flex-1 transition-colors ${
                i <= step ? "bg-primary" : "bg-outline-variant"
              }`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-5">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="font-mono text-[10px] tracking-widest uppercase text-outline hover:text-primary disabled:opacity-30 disabled:hover:text-outline transition-colors flex items-center gap-1"
          >
            <MaterialIcon name="arrow_back" className="text-[14px]" />
            Back
          </button>

          <p className="font-mono text-[9px] tracking-widest uppercase text-outline">
            {String(step + 1).padStart(2, "0")} / {String(STAGES.length).padStart(2, "0")}
          </p>

          {isLast ? (
            <button
              onClick={dismiss}
              className="font-mono text-[10px] tracking-widest uppercase bg-primary text-primary-foreground px-5 py-2.5 hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              Enter ledger
              <MaterialIcon name="arrow_forward" className="text-[14px]" />
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STAGES.length - 1, s + 1))}
              className="font-mono text-[10px] tracking-widest uppercase bg-primary text-primary-foreground px-5 py-2.5 hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              Continue
              <MaterialIcon name="arrow_forward" className="text-[14px]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
