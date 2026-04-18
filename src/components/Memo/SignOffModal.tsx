import { FormEvent, useState } from "react";
import { SignaturePad } from "./SignaturePad";

interface SignOffModalProps {
  onClose: () => void;
  onSubmit: (lawyerName: string, signatureDataUrl?: string) => Promise<void>;
}

export function SignOffModal({ onClose, onSubmit }: SignOffModalProps) {
  const [lawyerName, setLawyerName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!lawyerName.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(lawyerName.trim(), signature ?? undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-off failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary/70 flex items-center justify-center z-[120] p-4">
      <div className="bg-surface w-full max-w-2xl border border-outline-variant max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-outline-variant flex items-start justify-between">
          <div>
            <h2 className="font-headline text-xl font-bold text-primary">Approve Memo</h2>
            <p className="font-mono text-[9px] tracking-widest uppercase text-outline mt-1">
              Digital sign-off — this stamp will appear on the memo and the PDF export
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[10px] tracking-widest uppercase border border-outline-variant px-2 py-1 text-outline hover:text-primary transition-colors"
          >
            CLOSE
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div>
            <label className="font-mono text-[9px] tracking-widest uppercase text-outline block mb-2">
              Full Name &amp; Title
            </label>
            <input
              type="text"
              value={lawyerName}
              onChange={(e) => setLawyerName(e.target.value)}
              placeholder="e.g. Anna Lindqvist, Partner"
              className="w-full border border-outline-variant bg-surface font-body text-sm text-on-surface py-2 px-3 focus:outline-none focus:border-primary"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="font-mono text-[9px] tracking-widest uppercase text-outline block mb-2">
              Signature
            </label>
            <SignaturePad onChange={setSignature} />
            <p className="font-body text-xs text-on-surface-variant mt-2">
              Signature is optional — a typed name stamp alone is also accepted.
            </p>
          </div>

          {error && (
            <div className="bg-critical text-critical-foreground font-mono text-[10px] tracking-widest uppercase px-3 py-2">
              ✗ {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 font-mono text-[10px] tracking-widest uppercase border border-outline-variant text-outline hover:text-primary hover:border-primary py-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !lawyerName.trim()}
              className="flex-[2] bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase py-3 hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "SIGNING…" : "APPROVE & SIGN →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
