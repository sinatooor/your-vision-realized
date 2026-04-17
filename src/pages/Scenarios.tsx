import { Link } from "react-router-dom";
import { ScenarioTable } from "@/components/Results/ScenarioTable";
import { useAnalysis } from "@/contexts/AnalysisContext";

export default function Scenarios() {
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
            Run an analysis to compare entity structures — EOR, subsidiary, contractor — across
            risk dimensions.
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

  const recommended = result.scenarios.find((s) => s.recommended);

  return (
    <main
      className="flex-1 pt-[89px] pb-8 overflow-auto"
      style={{ height: "calc(100vh - 32px)" }}
    >
      <div className="px-12 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="font-headline text-2xl font-bold text-primary">Expansion Scenarios</h1>
          <p className="font-body text-sm text-on-surface-variant mt-1">
            Comparative analysis of entity structures across legal risk, compliance burden, and
            operational complexity.
          </p>
          {recommended && (
            <div className="mt-4 inline-flex items-center gap-2 border border-low px-3 py-1.5">
              <span className="w-2 h-2 bg-low rounded-full" />
              <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                Recommended:
              </span>
              <span className="font-mono text-[9px] tracking-widest uppercase text-primary font-bold">
                {recommended.label}
              </span>
            </div>
          )}
        </div>
        <ScenarioTable scenarios={result.scenarios} />
      </div>
    </main>
  );
}
