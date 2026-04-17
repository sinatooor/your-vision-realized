import ReactMarkdown from "react-markdown";

interface MemoExportProps {
  memo: { executiveSummary: string; memoMarkdown: string };
}

export function MemoExport({ memo }: MemoExportProps) {
  const handleDownload = () => {
    const blob = new Blob([memo.memoMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `JurisdictIQ-Advisory-Memo-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Executive summary card */}
      <div className="border-l-4 border-primary bg-surface-container px-6 py-5 mb-8">
        <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-3">
          EXECUTIVE SUMMARY
        </p>
        <p className="font-body text-base text-on-surface leading-relaxed italic">
          {memo.executiveSummary}
        </p>
      </div>

      {/* Export buttons */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={handleDownload}
          className="font-mono text-[10px] tracking-widest uppercase border border-primary text-primary px-5 py-2.5 hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          EXPORT AS MARKDOWN ↓
        </button>
      </div>

      {/* Full memo */}
      <div className="border border-outline-variant p-8 prose prose-sm max-w-none font-body text-on-surface">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h1 className="font-headline text-2xl font-bold text-primary mb-4">{children}</h1>,
            h2: ({ children }) => <h2 className="font-headline text-xl font-bold text-primary mt-8 mb-3">{children}</h2>,
            h3: ({ children }) => <h3 className="font-headline text-base font-bold text-primary mt-6 mb-2">{children}</h3>,
            p: ({ children }) => <p className="font-body text-sm text-on-surface leading-relaxed mb-3">{children}</p>,
            ul: ({ children }) => <ul className="space-y-1 mb-3 pl-4">{children}</ul>,
            li: ({ children }) => <li className="font-body text-sm text-on-surface flex gap-2"><span className="text-outline">—</span><span>{children}</span></li>,
            code: ({ children }) => <code className="font-mono text-xs bg-surface-highest px-1.5 py-0.5 text-on-surface">{children}</code>,
            blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 italic text-on-surface-variant">{children}</blockquote>,
            table: ({ children }) => <table className="w-full border-collapse text-sm mb-4">{children}</table>,
            th: ({ children }) => <th className="font-mono text-[9px] tracking-widest uppercase text-outline border border-outline-variant px-3 py-2 text-left bg-surface-container">{children}</th>,
            td: ({ children }) => <td className="font-body text-sm border border-outline-variant px-3 py-2">{children}</td>,
          }}
        >
          {memo.memoMarkdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
