import { Link } from "react-router-dom";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { MaterialIcon } from "@/components/MaterialIcon";

export default function Settings() {
  const { result, resetAnalysis } = useAnalysis();

  return (
    <main
      className="flex-1 pt-[89px] pb-8 overflow-auto"
      style={{ height: "calc(100vh - 32px)" }}
    >
      <div className="px-12 py-8 max-w-2xl">
        <div className="mb-10">
          <h1 className="font-headline text-3xl font-bold text-primary">Settings</h1>
          <p className="font-body text-sm text-on-surface-variant mt-2">
            Configure your JurisdictIQ workspace and analysis preferences.
          </p>
        </div>

        {/* Analysis Session */}
        <section id="settings-session" className="mb-8 scroll-mt-24">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-4">
            Current Analysis Session
          </p>
          <div className="border border-outline-variant">
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MaterialIcon name="analytics" className="text-[20px] text-outline" />
                <div>
                  <p className="font-body text-sm font-medium text-primary">
                    {result ? "Analysis Complete" : "No Active Analysis"}
                  </p>
                  <p className="font-mono text-[9px] tracking-widest uppercase text-outline mt-0.5">
                    {result
                      ? `${result.conflicts.length} conflicts · ${result.actions.length} actions · ${result.scenarios.length} scenarios`
                      : "Select a jurisdiction on the map to begin"}
                  </p>
                </div>
              </div>
              {result ? (
                <button
                  onClick={resetAnalysis}
                  className="font-mono text-[9px] tracking-widest uppercase border border-critical text-critical px-3 py-1.5 hover:bg-critical hover:text-critical-foreground transition-colors"
                >
                  Clear Analysis
                </button>
              ) : (
                <Link
                  to="/"
                  className="font-mono text-[9px] tracking-widest uppercase border border-primary text-primary px-3 py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  Begin Analysis →
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Analysis Defaults */}
        <section id="settings-defaults" className="mb-8 scroll-mt-24">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-4">
            Analysis Defaults
          </p>
          <div className="border border-outline-variant divide-y divide-outline-variant">
            {[
              {
                icon: "groups",
                label: "Default Arrangement",
                value: "Remote",
                note: "Applied when opening new jurisdiction panels",
              },
              {
                icon: "corporate_fare",
                label: "Default Entity Structure",
                value: "EOR",
                note: "Starting structure for scenario comparison",
              },
              {
                icon: "database",
                label: "Default Data Type",
                value: "HR Data Only",
                note: "Data categories processed by the client",
              },
            ].map(({ icon, label, value, note }) => (
              <div key={label} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MaterialIcon name={icon} className="text-[20px] text-outline" />
                  <div>
                    <p className="font-body text-sm text-primary">{label}</p>
                    <p className="font-mono text-[9px] tracking-widest uppercase text-outline mt-0.5">
                      {note}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] tracking-widest uppercase border border-outline-variant text-on-surface px-2.5 py-1">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mt-2">
            Configurable in jurisdiction panel — defaults coming in a future release
          </p>
        </section>

        {/* System Status */}
        <section id="settings-status" className="mb-8 scroll-mt-24">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-4">
            System Status
          </p>
          <div className="border border-outline-variant divide-y divide-outline-variant">
            {[
              { label: "Analysis API", status: "Connected", ok: true },
              { label: "AI Pipeline", status: "Operational", ok: true },
              { label: "Source Verification", status: "Live", ok: true },
            ].map(({ label, status, ok }) => (
              <div key={label} className="px-5 py-3 flex items-center justify-between">
                <p className="font-body text-sm text-primary">{label}</p>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-low" : "bg-critical"}`} />
                  <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                    {status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section id="settings-about" className="scroll-mt-24">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-4">
            About
          </p>
          <div className="border border-outline-variant px-5 py-4">
            <p className="font-body text-sm font-bold text-primary mb-1">JurisdictIQ</p>
            <p className="font-body text-sm text-on-surface-variant">
              AI-powered jurisdictional analysis for international employment and corporate law
              practitioners. Built for law firms advising on cross-border expansion.
            </p>
            <p className="font-mono text-[9px] tracking-widest uppercase text-outline mt-3">
              All AI output requires review by qualified legal counsel before reliance.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
