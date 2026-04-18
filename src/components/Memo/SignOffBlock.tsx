import { MemoSignOff } from "@/lib/memoChat";

interface SignOffBlockProps {
  signOff: MemoSignOff | null;
  onOpenSignOff: () => void;
  onRevoke: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function SignOffBlock({ signOff, onOpenSignOff, onRevoke }: SignOffBlockProps) {
  return (
    <div className="mt-12 border-t-2 border-primary pt-8">
      <h2 className="font-headline text-xl font-bold text-primary mb-6">Approvals</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lawyer sign-off */}
        <div className="border border-outline-variant p-6">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-3">
            Lawyer / Partner Sign-off
          </p>

          {signOff ? (
            <div>
              {signOff.signatureDataUrl && (
                <div className="bg-white border border-outline-variant mb-4 p-2">
                  <img
                    src={signOff.signatureDataUrl}
                    alt={`${signOff.lawyerName} signature`}
                    className="w-full h-24 object-contain"
                  />
                </div>
              )}
              <p className="font-headline text-lg font-bold text-primary">
                {signOff.lawyerName}
              </p>
              <p className="font-mono text-[10px] tracking-widest uppercase text-outline mt-1">
                Signed {formatDate(signOff.signedAt)}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 bg-low text-low-foreground px-3 py-1.5">
                <span className="w-1.5 h-1.5 bg-low-foreground rounded-full" />
                <span className="font-mono text-[9px] tracking-widest uppercase">
                  Approved — Ready for Client
                </span>
              </div>
              <div className="mt-4 print:hidden">
                <button
                  onClick={onRevoke}
                  className="font-mono text-[9px] tracking-widest uppercase text-outline hover:text-critical"
                >
                  Revoke sign-off
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="border border-dashed border-outline-variant h-24 mb-4 flex items-center justify-center">
                <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                  Awaiting signature
                </span>
              </div>
              <p className="font-body text-sm text-on-surface-variant mb-4">
                Review the memo above, then approve to mark it ready for client presentation.
              </p>
              <button
                onClick={onOpenSignOff}
                className="w-full bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase py-3 hover:bg-primary/90 transition-colors print:hidden"
              >
                Approve &amp; Sign Off →
              </button>
            </div>
          )}
        </div>

        {/* Client sign-off placeholder */}
        <div className="border border-outline-variant p-6 bg-surface-container-low">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-3">
            Client Sign-off
          </p>
          <div className="border border-dashed border-outline-variant h-24 mb-4 flex items-center justify-center">
            <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
              To be signed by client
            </span>
          </div>
          <p className="font-body text-sm text-on-surface-variant">
            This block will be completed in person when the memo is presented to the client.
            Leave blank for export.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono text-outline">
            <div>
              <p className="tracking-widest uppercase mb-1">Name</p>
              <div className="border-b border-outline-variant h-6" />
            </div>
            <div>
              <p className="tracking-widest uppercase mb-1">Date</p>
              <div className="border-b border-outline-variant h-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
