import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorldMap } from "@/components/Map/WorldMap";
import { JurisdictionPanel } from "@/components/Panel/JurisdictionPanel";
import { AgentStream } from "@/components/Panel/AgentStream";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { useCompany } from "@/contexts/CompanyContext";
import type { CompanyProfile, FootprintEntry, DataArchitecture, TransferFlow } from "@/contexts/CompanyContext";

// ── Inline-editable text field ────────────────────────────────────────────────

function EditableField({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const trimmed = draft.trim();
    onChange(trimmed || value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        className={`bg-surface-container border-b border-primary outline-none py-0.5 min-w-0 w-full ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(value);
          }
        }}
        autoFocus
      />
    );
  }

  return (
    <span
      className={`group cursor-text inline-flex items-center gap-1 ${className}`}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      {value}
      <MaterialIcon
        name="edit"
        className="text-[11px] text-outline opacity-0 group-hover:opacity-50 shrink-0"
      />
    </span>
  );
}

// ── Toggle badge ──────────────────────────────────────────────────────────────

function ToggleBadge({
  value,
  onToggle,
  trueLabel,
  falseLabel,
  trueClass,
  falseClass,
}: {
  value: boolean;
  onToggle: () => void;
  trueLabel: string;
  falseLabel: string;
  trueClass: string;
  falseClass: string;
}) {
  return (
    <button
      onClick={onToggle}
      className={`font-mono text-[9px] tracking-widest uppercase border px-2.5 py-1 shrink-0 whitespace-nowrap ${value ? trueClass : falseClass}`}
    >
      {value ? trueLabel : falseLabel}
    </button>
  );
}

// ── Overview page ─────────────────────────────────────────────────────────────

export default function Overview() {
  const navigate = useNavigate();
  const {
    presenceData,
    activeCountry,
    cases,
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
    savedExpansions,
    activeSavedId,
    loadSavedExpansion,
    removeSavedExpansion,
    startNewExpansion,
  } = useAnalysis();

  const { company, setCompany, footprint, setFootprint, dataArch, setDataArch } = useCompany();

  useEffect(() => {
    if (result && !hasNavigatedToResults) {
      markNavigatedToResults();
      navigate("/conflicts");
    }
  }, [result, hasNavigatedToResults, markNavigatedToResults, navigate]);

  // ── Footprint helpers ────────────────────────────────────────────────────────

  const updateFootprintRow = (idx: number, patch: Partial<FootprintEntry>) =>
    setFootprint((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const removeFootprintRow = (idx: number) =>
    setFootprint((prev) => prev.filter((_, i) => i !== idx));

  const addFootprintRow = () =>
    setFootprint((prev) => [
      ...prev,
      {
        iso: "??",
        country: "New Jurisdiction",
        entityType: "None",
        headcount: 0,
        localInvoicing: false,
        notes: "",
      },
    ]);

  // ── Data architecture helpers ────────────────────────────────────────────────

  const updateFlow = (idx: number, patch: Partial<TransferFlow>) =>
    setDataArch((prev) => ({
      ...prev,
      transferFlows: prev.transferFlows.map((f, i) =>
        i === idx ? { ...f, ...patch } : f,
      ),
    }));

  const removeFlow = (idx: number) =>
    setDataArch((prev) => ({
      ...prev,
      transferFlows: prev.transferFlows.filter((_, i) => i !== idx),
    }));

  const addFlow = () =>
    setDataArch((prev) => ({
      ...prev,
      transferFlows: [
        ...prev.transferFlows,
        { from: "SE", to: "??", categories: "HR data" },
      ],
    }));

  const updateCategory = (idx: number, val: string) =>
    setDataArch((prev) => ({
      ...prev,
      categories: prev.categories.map((c, i) => (i === idx ? val : c)),
    }));

  const removeCategory = (idx: number) =>
    setDataArch((prev) => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== idx),
    }));

  const addCategory = () =>
    setDataArch((prev) => ({
      ...prev,
      categories: [...prev.categories, "New Category"],
    }));

  return (
    <main
      className="flex-1 pt-[89px] pb-8 overflow-auto"
      style={{ height: "calc(100vh - 32px)" }}
    >
      {/* REGION SELECT — Map */}
      <section
        id="region-select"
        className="relative h-[calc(100vh-121px)] border-b border-outline-variant"
      >
        <div className="absolute inset-0">
          <WorldMap
            presenceData={presenceData}
            onCountryClick={handleCountryClick}
            activeCountry={activeCountry?.iso ?? null}
            selectedCountries={cases.map((c) => c.iso)}
            panelOpen={panelOpen}
          />

          <JurisdictionPanel />

          {/* AgentStream panel hidden — progress shown via button spinner */}

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
                    {
                      label: "TARGET COUNTRIES",
                      value: twin.expansion?.targetCountries.join(", "),
                    },
                    {
                      label: "DATA CATEGORIES",
                      value: twin.data?.categories.join(", "),
                    },
                    {
                      label: "HEADCOUNT BY COUNTRY",
                      value: JSON.stringify(twin.people?.hiresByCountry),
                    },
                    {
                      label: "CENTRALISED DATA",
                      value: String(twin.data?.centralised),
                    },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-0.5">
                        {label}
                      </p>
                      <p className="font-body text-sm text-primary font-bold truncate">
                        {value}
                      </p>
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

      {/* SECTION 02 — COMPANY PROFILE */}
      <section id="company-profile" className="px-12 py-16 max-w-5xl">
        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-2">
            Section 02
          </p>
          <h2 className="font-headline text-3xl font-bold text-primary">Company Profile</h2>
          <p className="font-body text-sm text-on-surface-variant mt-2 max-w-xl">
            Onboarded client details relevant to cross-border expansion strategy. Click any
            field to edit.
          </p>
        </div>

        <div className="border border-outline-variant">
          <div className="grid grid-cols-2 divide-x divide-outline-variant">
            {/* Left column */}
            <div className="divide-y divide-outline-variant">
              {(
                [
                  { label: "Legal Name", key: "name" },
                  { label: "HQ Jurisdiction", key: "hqCountry" },
                  { label: "Legal Entity Type", key: "legalEntity" },
                  { label: "Industry / Sector", key: "industry" },
                  { label: "Founded", key: "founded" },
                ] as { label: string; key: keyof CompanyProfile }[]
              ).map(({ label, key }) => (
                <div key={key} className="px-5 py-4">
                  <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                    {label}
                  </p>
                  <EditableField
                    value={String(company[key])}
                    onChange={(v) => setCompany((p) => ({ ...p, [key]: v }))}
                    className="font-body text-sm text-primary font-medium"
                  />
                </div>
              ))}
            </div>

            {/* Right column */}
            <div className="divide-y divide-outline-variant">
              <div className="px-5 py-4">
                <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                  Global Headcount
                </p>
                <EditableField
                  value={String(company.headcount)}
                  onChange={(v) =>
                    setCompany((p) => ({ ...p, headcount: parseInt(v) || p.headcount }))
                  }
                  className="font-body text-sm text-primary font-medium"
                />
              </div>
              <div className="px-5 py-4">
                <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                  Annual Revenue
                </p>
                <EditableField
                  value={company.revenue}
                  onChange={(v) => setCompany((p) => ({ ...p, revenue: v }))}
                  className="font-body text-sm text-primary font-medium"
                />
              </div>
              <div className="px-5 py-4">
                <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                  Product Category
                </p>
                <EditableField
                  value={company.productCategory}
                  onChange={(v) => setCompany((p) => ({ ...p, productCategory: v }))}
                  className="font-body text-sm text-primary font-medium"
                />
              </div>
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                    AI / ML Features
                  </p>
                  <p className="font-body text-sm text-on-surface-variant">
                    {company.hasAiFeatures
                      ? "EU AI Act obligations apply"
                      : "No AI/ML product features declared"}
                  </p>
                </div>
                <ToggleBadge
                  value={company.hasAiFeatures}
                  onToggle={() =>
                    setCompany((p) => ({ ...p, hasAiFeatures: !p.hasAiFeatures }))
                  }
                  trueLabel="Enabled"
                  falseLabel="Disabled"
                  trueClass="text-medium border-medium"
                  falseClass="text-outline border-outline-variant"
                />
              </div>
              <div className="px-5 py-4">
                <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                  Strategic Notes
                </p>
                <EditableField
                  value={company.notes}
                  onChange={(v) => setCompany((p) => ({ ...p, notes: v }))}
                  className="font-body text-sm text-on-surface-variant"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 03 — INTERNATIONAL FOOTPRINT */}
      <section
        id="international-footprint"
        className="px-12 py-16 max-w-5xl border-t border-outline-variant"
      >
        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-2">
            Section 03
          </p>
          <h2 className="font-headline text-3xl font-bold text-primary">
            International Footprint
          </h2>
          <p className="font-body text-sm text-on-surface-variant mt-2 max-w-xl">
            Current jurisdictions where the client has active presence, employment
            obligations, or contractual exposure. Click any cell to edit.
          </p>
        </div>

        <div className="border border-outline-variant">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-surface-container border-b border-outline-variant">
            <p className="col-span-1 font-mono text-[9px] tracking-widest uppercase text-outline">
              ISO
            </p>
            <p className="col-span-2 font-mono text-[9px] tracking-widest uppercase text-outline">
              Country
            </p>
            <p className="col-span-2 font-mono text-[9px] tracking-widest uppercase text-outline">
              Entity Type
            </p>
            <p className="col-span-1 font-mono text-[9px] tracking-widest uppercase text-outline text-right">
              HC
            </p>
            <p className="col-span-1 font-mono text-[9px] tracking-widest uppercase text-outline text-center">
              Inv.
            </p>
            <p className="col-span-4 font-mono text-[9px] tracking-widest uppercase text-outline">
              Notes
            </p>
            <p className="col-span-1" />
          </div>

          <div className="divide-y divide-outline-variant">
            {footprint.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 px-5 py-3 items-center">
                <div className="col-span-1">
                  <EditableField
                    value={row.iso}
                    onChange={(v) =>
                      updateFootprintRow(idx, { iso: v.toUpperCase().slice(0, 3) })
                    }
                    className="font-mono text-xs text-primary font-bold"
                  />
                </div>
                <div className="col-span-2">
                  <EditableField
                    value={row.country}
                    onChange={(v) => updateFootprintRow(idx, { country: v })}
                    className="font-body text-sm text-primary"
                  />
                </div>
                <div className="col-span-2">
                  <EditableField
                    value={row.entityType}
                    onChange={(v) => updateFootprintRow(idx, { entityType: v })}
                    className="font-body text-sm text-on-surface-variant"
                  />
                </div>
                <div className="col-span-1 text-right">
                  <EditableField
                    value={String(row.headcount)}
                    onChange={(v) =>
                      updateFootprintRow(idx, {
                        headcount: parseInt(v) || 0,
                      })
                    }
                    className="font-mono text-xs text-primary"
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  <ToggleBadge
                    value={row.localInvoicing}
                    onToggle={() =>
                      updateFootprintRow(idx, { localInvoicing: !row.localInvoicing })
                    }
                    trueLabel="Yes"
                    falseLabel="No"
                    trueClass="text-low border-low"
                    falseClass="text-outline border-outline-variant"
                  />
                </div>
                <div className="col-span-4">
                  <EditableField
                    value={row.notes}
                    onChange={(v) => updateFootprintRow(idx, { notes: v })}
                    className="font-body text-sm text-on-surface-variant"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => removeFootprintRow(idx)}
                    className="text-outline hover:text-critical transition-colors"
                    title="Remove jurisdiction"
                  >
                    <MaterialIcon name="close" className="text-[16px]" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-outline-variant">
            <button
              onClick={addFootprintRow}
              className="flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-outline hover:text-primary transition-colors"
            >
              <MaterialIcon name="add" className="text-[16px]" />
              Add Jurisdiction
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 04 — DATA & IP ARCHITECTURE */}
      <section
        id="data-architecture"
        className="px-12 py-16 max-w-5xl border-t border-outline-variant"
      >
        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-2">
            Section 04
          </p>
          <h2 className="font-headline text-3xl font-bold text-primary">
            Data & IP Architecture
          </h2>
          <p className="font-body text-sm text-on-surface-variant mt-2 max-w-xl">
            Personal data categories processed, storage jurisdictions, cross-border transfer
            flows, and data governance posture — inputs for GDPR/data compliance analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Data Categories */}
          <div className="border border-outline-variant p-5">
            <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-3">
              Data Categories Processed
            </p>
            <div className="flex flex-col gap-2">
              {dataArch.categories.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MaterialIcon
                      name="label"
                      className="text-[14px] text-outline shrink-0"
                    />
                    <EditableField
                      value={cat}
                      onChange={(v) => updateCategory(idx, v)}
                      className="font-body text-sm text-primary"
                    />
                  </div>
                  <button
                    onClick={() => removeCategory(idx)}
                    className="text-outline hover:text-critical transition-colors shrink-0"
                    title="Remove category"
                  >
                    <MaterialIcon name="close" className="text-[14px]" />
                  </button>
                </div>
              ))}
              <button
                onClick={addCategory}
                className="flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase text-outline hover:text-primary transition-colors mt-1"
              >
                <MaterialIcon name="add" className="text-[14px]" />
                Add Category
              </button>
            </div>
          </div>

          {/* Storage & Governance */}
          <div className="border border-outline-variant p-5 divide-y divide-outline-variant">
            <div className="pb-4">
              <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                Primary Storage Jurisdiction
              </p>
              <div className="flex items-center gap-2">
                <MaterialIcon name="storage" className="text-[16px] text-outline shrink-0" />
                <EditableField
                  value={dataArch.storageJurisdiction}
                  onChange={(v) => setDataArch((p) => ({ ...p, storageJurisdiction: v }))}
                  className="font-body text-sm text-primary font-medium"
                />
              </div>
            </div>

            <div className="py-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                  Centralised Architecture
                </p>
                <p className="font-body text-sm text-on-surface-variant">
                  All processing in HQ jurisdiction
                </p>
              </div>
              <ToggleBadge
                value={dataArch.centralized}
                onToggle={() =>
                  setDataArch((p) => ({ ...p, centralized: !p.centralized }))
                }
                trueLabel="Yes"
                falseLabel="No"
                trueClass="text-low border-low"
                falseClass="text-medium border-medium"
              />
            </div>

            <div className="py-4">
              <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                Retention Policy
              </p>
              <EditableField
                value={dataArch.retentionPolicy}
                onChange={(v) => setDataArch((p) => ({ ...p, retentionPolicy: v }))}
                className="font-body text-sm text-primary"
              />
            </div>

            <div className="pt-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                  DPA / SCCs in Place
                </p>
                <p className="font-body text-sm text-on-surface-variant">
                  Data Processing Agreements with all entities
                </p>
              </div>
              <ToggleBadge
                value={dataArch.dpaInPlace}
                onToggle={() =>
                  setDataArch((p) => ({ ...p, dpaInPlace: !p.dpaInPlace }))
                }
                trueLabel="Yes"
                falseLabel="No"
                trueClass="text-low border-low"
                falseClass="text-critical border-critical"
              />
            </div>
          </div>
        </div>

        {/* Cross-Border Transfer Flows */}
        <div className="border border-outline-variant">
          <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-surface-container border-b border-outline-variant">
            <p className="col-span-2 font-mono text-[9px] tracking-widest uppercase text-outline">
              From
            </p>
            <p className="col-span-2 font-mono text-[9px] tracking-widest uppercase text-outline">
              To
            </p>
            <p className="col-span-7 font-mono text-[9px] tracking-widest uppercase text-outline">
              Data Categories Transferred
            </p>
            <p className="col-span-1" />
          </div>

          <div className="divide-y divide-outline-variant">
            {dataArch.transferFlows.map((flow, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 px-5 py-3 items-center">
                <div className="col-span-2">
                  <EditableField
                    value={flow.from}
                    onChange={(v) =>
                      updateFlow(idx, { from: v.toUpperCase().slice(0, 3) })
                    }
                    className="font-mono text-xs text-primary font-bold"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-1.5">
                  <MaterialIcon name="arrow_forward" className="text-[12px] text-outline shrink-0" />
                  <EditableField
                    value={flow.to}
                    onChange={(v) =>
                      updateFlow(idx, { to: v.toUpperCase().slice(0, 3) })
                    }
                    className="font-mono text-xs text-primary font-bold"
                  />
                </div>
                <div className="col-span-7">
                  <EditableField
                    value={flow.categories}
                    onChange={(v) => updateFlow(idx, { categories: v })}
                    className="font-body text-sm text-on-surface-variant"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => removeFlow(idx)}
                    className="text-outline hover:text-critical transition-colors"
                    title="Remove flow"
                  >
                    <MaterialIcon name="close" className="text-[16px]" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-outline-variant">
            <button
              onClick={addFlow}
              className="flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-outline hover:text-primary transition-colors"
            >
              <MaterialIcon name="add" className="text-[16px]" />
              Add Transfer Flow
            </button>
          </div>
        </div>

        <div className="h-32" />
      </section>
    </main>
  );
}
