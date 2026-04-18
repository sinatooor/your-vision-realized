import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MemoExport } from "@/components/Results/MemoExport";
import { MemoChat } from "@/components/Memo/MemoChat";
import { SignOffBlock } from "@/components/Memo/SignOffBlock";
import { SignOffModal } from "@/components/Memo/SignOffModal";
import { useAnalysis } from "@/contexts/AnalysisContext";
import {
  MemoSignOff,
  fetchMemoChatState,
  revokeSignOff,
  submitSignOff,
} from "@/lib/memoChat";

export default function Memo() {
  const { result, sessionId, updateMemo } = useAnalysis();
  const [signOff, setSignOff] = useState<MemoSignOff | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    fetchMemoChatState(sessionId)
      .then((state) => {
        if (!cancelled) setSignOff(state.signOff);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

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

  const handleSignOff = async (name: string, sig?: string) => {
    if (!sessionId) throw new Error("Missing session");
    const next = await submitSignOff(sessionId, name, sig);
    setSignOff(next);
  };

  const handleRevoke = async () => {
    if (!sessionId) return;
    await revokeSignOff(sessionId);
    setSignOff(null);
  };

  return (
    <main
      className="flex-1 pt-[89px] pb-8 flex min-h-0"
      style={{ height: "calc(100vh - 32px)" }}
    >
      {/* Chat pane — hidden in print */}
      {sessionId && (
        <div className="w-[380px] flex-shrink-0 h-full p-4 print:hidden">
          <div className="h-full border border-outline-variant bg-surface shadow-sm overflow-hidden flex flex-col">
            <MemoChat
              sessionId={sessionId}
              onMemoUpdate={(markdown, summary) =>
                updateMemo({ memoMarkdown: markdown, executiveSummary: summary })
              }
            />
          </div>
        </div>
      )}

      {/* Memo pane */}
      <div className="flex-1 overflow-auto">
        <div className="px-10 py-8 max-w-4xl">
          <section id="memo-summary" className="mb-6 scroll-mt-24 print:hidden">
            <h1 className="font-headline text-2xl font-bold text-primary">Advisory Memorandum</h1>
            <p className="font-body text-sm text-on-surface-variant mt-1">
              AI-drafted legal memo for partner review. Use the chat on the left to refine the
              document, then sign off to mark it ready for client delivery.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 bg-surface-container border border-outline-variant px-3 py-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${signOff ? "bg-low" : "bg-medium"}`}
              />
              <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                {signOff
                  ? `Approved by ${signOff.lawyerName}`
                  : "AI-Generated — Requires Partner Review"}
              </span>
            </div>
          </section>

          <section id="memo-body" className="scroll-mt-24 mb-4">
            <MemoExport
              memo={{
                executiveSummary: result.executiveSummary,
                memoMarkdown: result.memoMarkdown,
              }}
            />
          </section>

          <section id="memo-signoff" className="scroll-mt-24">
            <SignOffBlock
              signOff={signOff}
              onOpenSignOff={() => setShowModal(true)}
              onRevoke={handleRevoke}
            />
          </section>
        </div>
      </div>

      {showModal && (
        <SignOffModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSignOff}
        />
      )}
    </main>
  );
}
