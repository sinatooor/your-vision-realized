import { Link } from "react-router-dom";
import { MemoExport } from "@/components/Results/MemoExport";
import { useAnalysis } from "@/contexts/AnalysisContext";

export default function Memo() {
  const { result } = useAnalysis();

  if (!result) {
    return (
      <main
        className="flex-1 pt-[89px] pb-8 flex items-center justify-center"
        style={{ height: "calc(100vh - 32px)" }}
      >
        <div className="text-center max-w-sm">
          <p className="font-mono text-[10px] tracking-widest uppercase text-outline mb-2">
            No Memo Generated
          </p>
          <p className="font-body text-sm text-on-surface-variant mb-6">
            Run an analysis to generate an AI-drafted legal memorandum ready for partner review
            and client delivery.
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

  return (
    <main
      className="flex-1 pt-[89px] pb-8 overflow-auto"
      style={{ height: "calc(100vh - 32px)" }}
    >
      <div className="px-12 py-8 max-w-5xl">
        <section id="memo-summary" className="mb-8 scroll-mt-24">
          <h1 className="font-headline text-2xl font-bold text-primary">Advisory Memorandum</h1>
          <p className="font-body text-sm text-on-surface-variant mt-1">
            AI-drafted legal memo for partner review. Always verify findings with qualified local
            counsel before client delivery.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 bg-surface-container border border-outline-variant px-3 py-1.5">
            <span className="w-1.5 h-1.5 bg-medium rounded-full" />
            <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
              AI-Generated — Requires Partner Review
            </span>
          </div>
        </section>
        <section id="memo-body" className="scroll-mt-24 mb-12">
          <MemoExport
            memo={{
              executiveSummary: result.executiveSummary,
              memoMarkdown: result.memoMarkdown,
            }}
          />
        </section>
        <section id="memo-export" className="scroll-mt-24">
          <h2 className="font-headline text-xl font-bold text-primary mb-3">Export</h2>
          <p className="font-body text-sm text-on-surface-variant">
            Use the export controls above to download the memo for partner review or client delivery.
          </p>
        </section>
      </div>
    </main>
  );
}
