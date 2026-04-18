import { FormEvent, useEffect, useRef, useState } from "react";
import {
  MemoChatTurn,
  SupportingDocumentMeta,
  deleteSupportingDocument,
  fetchMemoChatState,
  sendMemoChatMessage,
  uploadSupportingDocument,
} from "@/lib/memoChat";

interface MemoChatProps {
  sessionId: string;
  onMemoUpdate: (markdown: string, executiveSummary: string) => void;
}

export function MemoChat({ sessionId, onMemoUpdate }: MemoChatProps) {
  const [history, setHistory] = useState<MemoChatTurn[]>([]);
  const [documents, setDocuments] = useState<SupportingDocumentMeta[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMemoChatState(sessionId)
      .then((state) => {
        if (cancelled) return;
        setHistory(state.history);
        setDocuments(state.documents);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, sending]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    const optimisticUser: MemoChatTurn = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    setHistory((h) => [...h, optimisticUser]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const result = await sendMemoChatMessage(sessionId, message);
      setHistory(result.history);
      onMemoUpdate(result.memoMarkdown, result.executiveSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
      setHistory((h) => h.slice(0, -1));
      setInput(message);
    } finally {
      setSending(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadSupportingDocument(sessionId, file);
      setDocuments((d) => [...d, doc]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveDoc = async (docId: string) => {
    await deleteSupportingDocument(sessionId, docId);
    setDocuments((d) => d.filter((doc) => doc.id !== docId));
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface">
      {/* Header */}
      <div className="px-5 py-4 border-b border-outline-variant">
        <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
          Memo Collaboration
        </p>
        <h2 className="font-headline text-lg font-bold text-primary">Refine with AI</h2>
        <p className="font-body text-xs text-on-surface-variant mt-1">
          Type instructions to edit the memo. The AI rewrites the document in the pane on the right.
        </p>
      </div>

      {/* Supporting docs */}
      {documents.length > 0 && (
        <div className="px-5 py-3 border-b border-outline-variant bg-surface-container-low">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-2">
            Supporting Documents
          </p>
          <div className="flex flex-wrap gap-2">
            {documents.map((doc) => (
              <span
                key={doc.id}
                className="inline-flex items-center gap-2 border border-outline-variant px-2 py-1 font-mono text-[10px] text-primary"
              >
                <span className="truncate max-w-[180px]">{doc.name}</span>
                <button
                  onClick={() => handleRemoveDoc(doc.id)}
                  className="text-outline hover:text-critical"
                  aria-label={`Remove ${doc.name}`}
                  type="button"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {history.length === 0 && (
          <div className="text-center text-outline font-mono text-[10px] tracking-widest uppercase py-8">
            No messages yet — try "Shorten the executive summary to one paragraph"
          </div>
        )}
        {history.map((turn, i) => (
          <div
            key={i}
            className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 ${
                turn.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-container border border-outline-variant text-on-surface"
              }`}
            >
              <p className="font-mono text-[9px] tracking-widest uppercase opacity-60 mb-1">
                {turn.role === "user" ? "Lawyer" : "AI Partner"}
              </p>
              <p className="font-body text-sm leading-relaxed whitespace-pre-wrap">
                {turn.content}
              </p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-surface-container border border-outline-variant px-4 py-3 flex items-center gap-2">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
              </span>
              <p className="font-mono text-[9px] tracking-widest uppercase text-outline">
                Processing document…
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-2 bg-critical text-critical-foreground font-mono text-[10px] tracking-widest uppercase">
          ✗ {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-outline-variant p-3">
        <div className="flex gap-2 mb-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
            accept=".txt,.md,.markdown,.csv,.json,.xml,.html,.rtf,.pdf,.doc,.docx"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="font-mono text-[10px] tracking-widest uppercase border border-outline-variant text-outline hover:text-primary hover:border-primary px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {uploading ? "UPLOADING…" : "+ ATTACH FILE"}
          </button>
        </div>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="e.g. Add a paragraph on Vietnam data localisation obligations…"
            rows={2}
            className="flex-1 border border-outline-variant bg-surface font-body text-sm text-on-surface p-3 resize-none focus:outline-none focus:border-primary"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase px-4 hover:bg-primary/90 disabled:opacity-50"
          >
            SEND
          </button>
        </div>
      </form>
    </div>
  );
}
