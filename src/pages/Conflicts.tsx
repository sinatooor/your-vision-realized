import { Link } from "react-router-dom";
import { ConflictMap } from "@/components/Results/ConflictMap";
import { ObligationsTable } from "@/components/Results/ObligationsTable";
import { useAnalysis } from "@/contexts/AnalysisContext";

export default function Conflicts() {
  const { result } = useAnalysis();

  if (!result) {
    return (
      <main
        className="flex-1 pt-[89px] pb-8 flex items-center justify-center"
        style={{ height: "calc(100vh - 32px)" }}
      >
        <div className="text-center max-w-sm">
          <p className="font-mono text-[10px] tracking-widest uppercase text-outline mb-2">
            No Analysis Results
          </p>
          <p className="font-body text-sm text-on-surface-variant mb-6">
            Select a jurisdiction on the map and run an analysis to identify regulatory conflicts.
          </p>
          <Link
            to="/"
            className="font-mono text-[10px] tracking-widest uppercase border border-primary text-primary px-5 py-2.5 hover:bg-primary hover:text-primary-foreground transition-colors inline-block"
          >
            Begin Analysis →
          </Link>
        </div>
      </main>
    );
  }

  const critical = result.conflicts.filter((c) => c.severity === "critical").length;
  const blocking = result.conflicts.filter((c) => c.blocksExpansion).length;

  return (
    <main
      className="flex-1 pt-[89px] pb-8 overflow-auto"
      style={{ height: "calc(100vh - 32px)" }}
    >
      <div className="px-12 py-8 max-w-5xl">
        <section id="conflicts-summary" className="mb-8 scroll-mt-24">
          <h1 className="font-headline text-2xl font-bold text-primary">
            Jurisdictional Conflicts
          </h1>
          <p className="font-body text-sm text-on-surface-variant mt-1">
            Cross-border regulatory conflicts identified for your expansion scenario.
          </p>
          <div className="flex gap-6 mt-4">
            <div>
              <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                Total Conflicts
              </span>
              <p className="font-headline text-2xl font-bold text-primary">
                {result.conflicts.length}
              </p>
            </div>
            {critical > 0 && (
              <div>
                <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                  Critical
                </span>
                <p className="font-headline text-2xl font-bold text-critical">{critical}</p>
              </div>
            )}
            {blocking > 0 && (
              <div>
                <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                  Blocking Expansion
                </span>
                <p className="font-headline text-2xl font-bold text-critical">{blocking}</p>
              </div>
            )}
          </div>
        </section>
        <section id="conflicts-critical" className="scroll-mt-24 mb-12">
          <ConflictMap conflicts={result.conflicts} obligations={result.obligations} />
        </section>
        <section id="conflicts-mitigation" className="scroll-mt-24 mb-12">
          <h2 className="font-headline text-xl font-bold text-primary mb-3">Mitigation Strategies</h2>
          <p className="font-body text-sm text-on-surface-variant">
            Recommended mitigation approaches per conflict are listed inline within each conflict card above. Prioritise critical and blocking items first.
          </p>
        </section>
        <section id="conflicts-obligations" className="scroll-mt-24">
          <h2 className="font-headline text-xl font-bold text-primary mb-2">Risk Register</h2>
          <p className="font-body text-sm text-on-surface-variant mb-6">
            {result.obligations.length} obligation{result.obligations.length === 1 ? "" : "s"} identified across the analysed jurisdictions.
            Click a row to see the trigger, threshold, and statutory source.
          </p>
          <ObligationsTable obligations={result.obligations} />
        </section>
      </div>
    </main>
  );
}
