interface Counter {
  label: string;
  count: number;
  variant: "critical" | "high" | "medium" | "low";
}

const counters: Counter[] = [
  { label: "Critical", count: 1, variant: "critical" },
  { label: "High", count: 2, variant: "high" },
  { label: "Medium", count: 0, variant: "medium" },
  { label: "Low", count: 3, variant: "low" },
];

const dotColor: Record<Counter["variant"], string> = {
  critical: "bg-critical",
  high: "bg-on-surface-variant",
  medium: "bg-outline-variant",
  low: "bg-low/60",
};

const textColor: Record<Counter["variant"], string> = {
  critical: "text-primary font-medium",
  high: "text-on-surface-variant",
  medium: "text-outline",
  low: "text-outline",
};

export const SummaryBar = () => (
  <div className="bg-surface-lowest py-6 px-8 mb-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6 ledger-shadow">
    <h1 className="font-headline text-3xl font-medium text-primary tracking-tight">
      Active Conflicts
    </h1>
    <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs tracking-[0.15em] uppercase">
      {counters.map((c) => (
        <div key={c.label} className="flex items-center space-x-2">
          <span className={`w-2 h-2 block ${dotColor[c.variant]}`} />
          <span className={textColor[c.variant]}>
            {c.label}: {c.count}
          </span>
        </div>
      ))}
    </div>
  </div>
);
