import { useState } from "react";
import { Conflict, Obligation, Severity } from "@/types";

interface ConflictMapProps {
  conflicts: Conflict[];
  obligations: Obligation[];
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "bg-critical text-critical-foreground",
  high: "bg-high text-high-foreground",
  medium: "bg-medium text-medium-foreground",
  low: "bg-low text-low-foreground",
};

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-critical",
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
};

const TYPE_LABELS: Record<string, string> = {
  conflict: "CONFLICT",
  tension: "TENSION",
  dependency: "DEPENDENCY",
  trigger_risk: "TRIGGER RISK",
  compatible: "COMPATIBLE",
};

export function ConflictMap({ conflicts, obligations: _obligations }: ConflictMapProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const countBySeverity = (s: Severity) => conflicts.filter((c) => c.severity === s).length;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Summary bar */}
      <div className="flex gap-6 mb-8">
        {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-3 h-3 ${SEVERITY_DOT[s]}`} />
            <span className="font-mono text-[10px] tracking-widest uppercase text-outline">
              {s}:
            </span>
            <span className="font-headline text-lg font-bold text-primary">{countBySeverity(s)}</span>
          </div>
        ))}
      </div>

      {/* Conflict list */}
      <div className="space-y-4">
        {conflicts.map((conflict) => (
          <div key={conflict.id} className="border border-outline-variant">
            {/* Blocking banner */}
            {conflict.blocksExpansion && (
              <div className="bg-critical text-critical-foreground font-mono text-[9px] tracking-widest uppercase px-4 py-1.5">
                ⚑ BLOCKS EXPANSION — IMMEDIATE ACTION REQUIRED
              </div>
            )}

            {/* Header */}
            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 ${SEVERITY_COLORS[conflict.severity]}`}>
                      {conflict.severity}
                    </span>
                    <span className="font-mono text-[9px] tracking-widest uppercase text-outline border border-outline-variant px-2 py-0.5">
                      {TYPE_LABELS[conflict.type] ?? conflict.type.toUpperCase()}
                    </span>
                  </div>
                  <p
                    className={`font-body text-sm text-on-surface leading-relaxed ${
                      expanded.has(conflict.id) ? "" : "line-clamp-2"
                    }`}
                  >
                    {conflict.explanation}
                  </p>
                  {conflict.explanation.length > 200 && (
                    <button
                      onClick={() => toggle(conflict.id)}
                      className="font-mono text-[9px] tracking-widest uppercase text-outline hover:text-primary mt-1"
                    >
                      {expanded.has(conflict.id) ? "COLLAPSE" : "EXPAND"}
                    </button>
                  )}
                </div>
              </div>

              {/* Mitigation options */}
              {conflict.mitigationOptions.length > 0 && (
                <div className="mt-4 border-t border-outline-variant pt-4">
                  <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-2">
                    MITIGATION OPTIONS
                  </p>
                  <div className="space-y-2">
                    {conflict.mitigationOptions.map((m, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="font-mono text-[10px] text-outline mt-0.5">{i + 1}.</span>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-body text-sm font-medium text-primary">{m.option}</span>
                            <span className="font-mono text-[9px] tracking-widest uppercase text-outline border border-outline-variant px-1.5">
                              {m.operationalImpact} impact
                            </span>
                          </div>
                          <p className="font-body text-xs text-on-surface-variant">{m.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {conflicts.length === 0 && (
        <div className="text-center py-16 text-outline font-mono text-[10px] tracking-widest uppercase">
          NO CONFLICTS DETECTED
        </div>
      )}
    </div>
  );
}
