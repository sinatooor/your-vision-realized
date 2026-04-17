export type Severity = "critical" | "high" | "medium" | "low";

export interface Conflict {
  id: string;
  severity: Severity;
  severityLabel: string;
  titleLeft: string;
  titleRight?: string;
  body: string;
  directives?: string[];
}

const sealStyle: Record<Severity, string> = {
  critical: "bg-critical text-critical-foreground",
  high: "bg-primary text-primary-foreground",
  medium: "bg-surface-highest text-on-surface-variant",
  low: "bg-low text-low-foreground",
};

export const ConflictCard = ({ conflict }: { conflict: Conflict }) => {
  return (
    <article className="bg-surface-low p-8 md:p-12 relative">
      <div
        className={`absolute top-0 right-0 font-mono text-[10px] px-4 py-2 uppercase tracking-[0.2em] font-medium ${sealStyle[conflict.severity]}`}
      >
        {conflict.severityLabel}
      </div>

      <h3 className="font-headline text-2xl md:text-3xl text-primary mb-6 pr-32 md:pr-40 leading-snug">
        {conflict.titleLeft}
        {conflict.titleRight && (
          <>
            <span className="font-body font-light text-outline px-3">↔</span>
            {conflict.titleRight}
          </>
        )}
      </h3>

      <div className="flex flex-col md:flex-row gap-8 md:gap-12">
        <div className="flex-1">
          <p className="font-body text-base md:text-lg text-on-surface-variant leading-relaxed">
            {conflict.body}
          </p>
        </div>
        {conflict.directives && conflict.directives.length > 0 && (
          <div className="w-full md:w-64 flex-shrink-0">
            <h4 className="mono-label mb-6">Mitigation Directives</h4>
            <div className="flex flex-col space-y-3">
              {conflict.directives.map((d) => (
                <div
                  key={d}
                  className="bg-surface-highest px-4 py-3 font-mono text-xs text-primary tracking-wide border-l-2 border-primary"
                >
                  {d}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
