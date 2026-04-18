import ReactMarkdown from "react-markdown";
import { useState } from "react";
import {
  exportMemoAsDocx,
  exportMemoAsMarkdown,
  exportMemoAsPdf,
} from "@/lib/memoExporters";

interface MemoExportProps {
  memo: { executiveSummary: string; memoMarkdown: string };
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="font-headline text-2xl font-bold text-primary mb-4">{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="font-headline text-xl font-bold text-primary mt-8 mb-3">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="font-headline text-base font-bold text-primary mt-6 mb-2">{children}</h3>,
  p: ({ children }: { children?: React.ReactNode }) => <p className="font-body text-sm text-on-surface leading-relaxed mb-3">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-bold text-primary">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="space-y-1 mb-3 pl-4">{children}</ul>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="font-body text-sm text-on-surface flex gap-2"><span className="text-outline">—</span><span>{children}</span></li>,
  code: ({ children }: { children?: React.ReactNode }) => <code className="font-mono text-xs bg-surface-highest px-1.5 py-0.5 text-on-surface">{children}</code>,
  blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="border-l-4 border-primary pl-4 italic text-on-surface-variant">{children}</blockquote>,
  table: ({ children }: { children?: React.ReactNode }) => <table className="w-full border-collapse text-sm mb-4">{children}</table>,
  th: ({ children }: { children?: React.ReactNode }) => <th className="font-mono text-[9px] tracking-widest uppercase text-outline border border-outline-variant px-3 py-2 text-left bg-surface-container">{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td className="font-body text-sm border border-outline-variant px-3 py-2">{children}</td>,
};

const summaryComponents = {
  ...markdownComponents,
  p: ({ children }: { children?: React.ReactNode }) => <p className="font-body text-base text-on-surface leading-relaxed italic mb-2 last:mb-0">{children}</p>,
};

export function MemoExport({ memo }: MemoExportProps) {
  const [busy, setBusy] = useState<null | "pdf" | "docx" | "md">(null);

  const handleMarkdown = () => {
    setBusy("md");
    try {
      exportMemoAsMarkdown(memo);
    } finally {
      setBusy(null);
    }
  };

  const handlePdf = () => {
    setBusy("pdf");
    try {
      exportMemoAsPdf(memo);
    } finally {
      setBusy(null);
    }
  };

  const handleDocx = async () => {
    setBusy("docx");
    try {
      await exportMemoAsDocx(memo);
    } finally {
      setBusy(null);
    }
  };

  const btnClass =
    "font-mono text-[10px] tracking-widest uppercase border border-primary text-primary px-5 py-2.5 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="memo-export-root">
      {/* Executive summary card */}
      <div className="border-l-4 border-primary bg-surface-container px-6 py-5 mb-8">
        <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-3">
          EXECUTIVE SUMMARY
        </p>
        <div className="font-body text-base text-on-surface leading-relaxed">
          <ReactMarkdown components={summaryComponents}>{memo.executiveSummary}</ReactMarkdown>
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex flex-wrap gap-3 mb-8 print:hidden">
        <button onClick={handlePdf} disabled={busy !== null} className={btnClass}>
          {busy === "pdf" ? "EXPORTING…" : "EXPORT AS PDF ↓"}
        </button>
        <button onClick={handleDocx} disabled={busy !== null} className={btnClass}>
          {busy === "docx" ? "EXPORTING…" : "EXPORT AS DOCX ↓"}
        </button>
        <button onClick={handleMarkdown} disabled={busy !== null} className={btnClass}>
          {busy === "md" ? "EXPORTING…" : "EXPORT AS MARKDOWN ↓"}
        </button>
      </div>

      {/* Full memo */}
      <div className="border border-outline-variant p-8 prose prose-sm max-w-none font-body text-on-surface">
        <ReactMarkdown components={markdownComponents}>{memo.memoMarkdown}</ReactMarkdown>
      </div>
    </div>
  );
}
