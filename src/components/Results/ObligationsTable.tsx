import { useMemo, useState } from "react";
import { Obligation, Severity } from "@/types";

interface ObligationsTableProps {
  obligations: Obligation[];
}

type Stoplight = "red" | "yellow" | "green";

const STOPLIGHT_LABELS: Record<Stoplight, string> = {
  red: "HIGH RISK",
  yellow: "MODERATE",
  green: "LOW RISK",
};

const STOPLIGHT_BADGE: Record<Stoplight, string> = {
  red: "bg-critical text-critical-foreground",
  yellow: "bg-medium text-medium-foreground",
  green: "bg-low text-low-foreground",
};

const toStoplight = (s: Severity): Stoplight => {
  if (s === "critical" || s === "high") return "red";
  if (s === "medium") return "yellow";
  return "green";
};

const CATEGORY_LABELS: Record<string, string> = {
  tax: "TAX",
  employment: "EMPLOYMENT",
  data: "DATA",
  licensing: "LICENSING",
  sanctions: "SANCTIONS",
  corporate: "CORPORATE",
};

export function ObligationsTable({ obligations }: ObligationsTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const map = new Map<string, Obligation[]>();
    for (const o of obligations) {
      if (!map.has(o.jurisdiction)) map.set(o.jurisdiction, []);
      map.get(o.jurisdiction)!.push(o);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const rank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return rank[a.severity] - rank[b.severity];
      });
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [obligations]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (obligations.length === 0) {
    return (
      <div className="text-center py-12 text-outline font-mono text-[10px] tracking-widest uppercase border border-outline-variant">
        NO OBLIGATIONS IDENTIFIED
      </div>
    );
  }

  return (
    <div className="border border-outline-variant">
      {/* Header row */}
      <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-surface-container border-b border-outline-variant">
        <p className="col-span-2 font-mono text-[9px] tracking-widest uppercase text-outline">
          Category
        </p>
        <p className="col-span-5 font-mono text-[9px] tracking-widest uppercase text-outline">
          Obligation
        </p>
        <p className="col-span-2 font-mono text-[9px] tracking-widest uppercase text-outline">
          Severity
        </p>
        <p className="col-span-2 font-mono text-[9px] tracking-widest uppercase text-outline">
          Counsel
        </p>
        <p className="col-span-1 font-mono text-[9px] tracking-widest uppercase text-outline text-right">
          Confidence
        </p>
      </div>

      {grouped.map(([jurisdiction, items]) => (
        <div key={jurisdiction} className="border-b border-outline-variant last:border-b-0">
          {/* Jurisdiction band */}
          <div className="px-5 py-2 bg-surface-container-low flex items-center justify-between">
            <p className="font-headline text-base font-bold text-primary">{jurisdiction}</p>
            <p className="font-mono text-[9px] tracking-widest uppercase text-outline">
              {items.length} obligation{items.length === 1 ? "" : "s"}
            </p>
          </div>

          {/* Rows */}
          <div className="divide-y divide-outline-variant">
            {items.map((o) => {
              const bucket = toStoplight(o.severity);
              const isOpen = expanded.has(o.id);
              return (
                <div key={o.id}>
                  <button
                    onClick={() => toggle(o.id)}
                    className="w-full grid grid-cols-12 gap-4 px-5 py-3 items-center hover:bg-surface-container-low transition-colors text-left"
                  >
                    <p className="col-span-2 font-mono text-[9px] tracking-widest uppercase text-outline">
                      {CATEGORY_LABELS[o.category] ?? o.category.toUpperCase()}
                    </p>
                    <p className="col-span-5 font-body text-sm text-primary font-medium flex items-center gap-2 flex-wrap">
                      {o.title}
                      {o.legislationStatus === "proposed" && (
                        <span className="font-mono text-[8px] tracking-widest uppercase border border-medium text-medium px-1.5 py-0.5 shrink-0">
                          PROPOSED
                        </span>
                      )}
                      {o.legislationStatus === "upcoming" && (
                        <span className="font-mono text-[8px] tracking-widest uppercase border border-high text-high px-1.5 py-0.5 shrink-0">
                          UPCOMING{o.effectiveDate ? ` — ${o.effectiveDate.slice(0, 7)}` : ""}
                        </span>
                      )}
                    </p>
                    <div className="col-span-2">
                      <span
                        className={`font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 ${STOPLIGHT_BADGE[bucket]}`}
                      >
                        {STOPLIGHT_LABELS[bucket]}
                      </span>
                    </div>
                    <p className="col-span-2 font-mono text-[9px] tracking-widest uppercase text-outline">
                      {o.requiresLocalCounsel ? "LOCAL COUNSEL" : "IN-HOUSE OK"}
                    </p>
                    <p className="col-span-1 font-mono text-xs text-on-surface text-right">
                      {Math.round(o.confidence * 100)}%
                    </p>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-4 pt-1 bg-surface-container-low">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                            Description
                          </p>
                          <p className="font-body text-sm text-on-surface leading-relaxed">
                            {o.description}
                          </p>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                              Trigger
                            </p>
                            <p className="font-body text-sm text-on-surface">{o.trigger}</p>
                          </div>
                          {o.threshold && (
                            <div>
                              <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                                Threshold
                              </p>
                              <p className="font-body text-sm text-on-surface">{o.threshold}</p>
                            </div>
                          )}
                          <div>
                            <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
                              Source
                            </p>
                            <a
                              href={o.source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs text-primary hover:underline break-all"
                            >
                              {o.source.citation}
                            </a>
                            {o.source.isLive && (
                              <span className="ml-2 font-mono text-[9px] tracking-widest uppercase text-low border border-low px-1.5 py-0.5">
                                LIVE
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
