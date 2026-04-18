import { Link } from "react-router-dom";
import { ActionPlan } from "@/components/Results/ActionPlan";
import { useAnalysis } from "@/contexts/AnalysisContext";

export default function Plan() {
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
            Run an analysis to generate a structured action plan with task ownership and
            timelines for your matter.
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

  const blocking = result.actions.filter((a) => a.blocking).length;
  const byOwner = (owner: string) => result.actions.filter((a) => a.owner === owner).length;

  return (
    <main
      className="flex-1 pt-[89px] pb-8 overflow-auto"
      style={{ height: "calc(100vh - 32px)" }}
    >
      <div className="px-12 py-8 max-w-5xl">
        <section id="plan-summary" className="mb-8 scroll-mt-24">
          <h1 className="font-headline text-2xl font-bold text-primary">Action Plan</h1>
          <p className="font-body text-sm text-on-surface-variant mt-1">
            Sequenced legal tasks across a 90-day horizon with clear ownership and dependencies.
          </p>
          <div className="flex gap-6 mt-4">
            <div>
              <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                Total Actions
              </span>
              <p className="font-headline text-2xl font-bold text-primary">
                {result.actions.length}
              </p>
            </div>
            {blocking > 0 && (
              <div>
                <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                  Blocking
                </span>
                <p className="font-headline text-2xl font-bold text-critical">{blocking}</p>
              </div>
            )}
            {byOwner("partner") > 0 && (
              <div>
                <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                  Partner Tasks
                </span>
                <p className="font-headline text-2xl font-bold text-primary">
                  {byOwner("partner")}
                </p>
              </div>
            )}
          </div>
        </section>
        <section id="plan-blocking" className="scroll-mt-24 mb-10">
          <h2 className="font-headline text-xl font-bold text-primary mb-2">Blocking Actions</h2>
          <p className="font-body text-sm text-on-surface-variant">
            {blocking} action{blocking === 1 ? "" : "s"} must be completed before the expansion can proceed.
          </p>
        </section>
        <section id="plan-timeline" className="scroll-mt-24 mb-12">
          <ActionPlan actions={result.actions} />
        </section>
        <section id="plan-owners" className="scroll-mt-24">
          <h2 className="font-headline text-xl font-bold text-primary mb-3">Owners</h2>
          <p className="font-body text-sm text-on-surface-variant">
            Tasks are distributed across partner, associate, local counsel, and client roles. Confirm assignments with the matter team.
          </p>
        </section>
      </div>
    </main>
  );
}
