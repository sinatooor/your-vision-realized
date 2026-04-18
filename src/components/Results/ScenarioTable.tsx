import { useState } from "react";
import { Scenario } from "@/types";

interface ScenarioTableProps {
  scenarios: Scenario[];
}

// Stoplight model — aligned with ConflictMap.
// Lower score = lower risk / better outcome.
function scoreColor(score: number): string {
  if (score <= 33) return "text-low";       // green
  if (score <= 66) return "text-medium";    // yellow
  return "text-critical";                    // red
}

function scoreDot(score: number): string {
  if (score <= 33) return "bg-low";
  if (score <= 66) return "bg-medium";
  return "bg-critical";
}

export function ScenarioTable({ scenarios }: ScenarioTableProps) {
  const [expandedRationale, setExpandedRationale] = useState<string | null>(null);

  const ordered = [...scenarios].sort((a, b) => a.score.total - b.score.total);

  const rows: Array<{ label: string; key: keyof Scenario["score"] | "time" }> = [
    { label: "Legal Risk", key: "legalRisk" },
    { label: "Compliance Burden", key: "complianceBurden" },
    { label: "Time to Launch", key: "time" },
    { label: "Operational Complexity", key: "operationalComplexity" },
    { label: "Total Score", key: "total" },
  ];

  return (
    <div>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <h3 className="font-headline text-xl font-bold text-primary">Scenario Comparison</h3>
        <div className="border border-outline-variant px-4 py-2">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1.5">
            Scoring Legend · Lower = Better
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 ${scoreDot(10)}`} />
              <span className="font-mono text-[9px] tracking-widest uppercase text-outline">0&ndash;33 Low Risk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 ${scoreDot(50)}`} />
              <span className="font-mono text-[9px] tracking-widest uppercase text-outline">34&ndash;66 Moderate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 ${scoreDot(80)}`} />
              <span className="font-mono text-[9px] tracking-widest uppercase text-outline">67&ndash;100 High Risk</span>
            </div>
          </div>
        </div>
      </div>

      <p className="font-body text-xs text-on-surface-variant mb-6 max-w-2xl">
        Each dimension is scored 0&ndash;100 by Agent 4 based on the statutes, conflicts, and
        obligations identified for the target jurisdiction. The total score is the equally-weighted
        sum across Legal Risk, Compliance Burden, and Operational Complexity. Time to Launch is
        shown in calendar days and is informational only &mdash; it is not part of the total score.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-primary">
              <th className="text-left font-mono text-[9px] tracking-widest uppercase text-outline py-3 pr-4 w-36">
                DIMENSION
              </th>
              {ordered.map((s) => (
                <th
                  key={s.id}
                  className={`text-center py-3 px-4 font-mono text-[9px] tracking-widest uppercase ${
                    s.recommended
                      ? "border-x-2 border-t-2 border-primary text-primary"
                      : "text-outline"
                  }`}
                >
                  {s.recommended && (
                    <div className="text-low mb-1">✓ RECOMMENDED</div>
                  )}
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, key }) => (
              <tr key={key} className="border-b border-outline-variant">
                <td className="py-3 pr-4 font-mono text-[9px] tracking-widest uppercase text-outline">
                  {label}
                </td>
                {ordered.map((s) => {
                  const isTime = key === "time";
                  const value = isTime ? s.score.timeToLaunchDays : s.score[key as keyof Scenario["score"]];
                  const isTotal = key === "total";
                  return (
                    <td
                      key={s.id}
                      className={`py-3 px-4 text-center font-headline font-bold ${
                        s.recommended ? "border-x-2 border-primary" : ""
                      } ${isTotal ? "border-t border-outline-variant" : ""} ${
                        isTime ? "text-on-surface" : scoreColor(value as number)
                      }`}
                    >
                      {isTime ? `${value}d` : `${value}`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rationale cards */}
      <div className="mt-8 space-y-3">
        <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-3">
          SCENARIO RATIONALE
        </p>
        {ordered.map((s) => (
          <div key={s.id} className="border border-outline-variant">
            <button
              className="w-full px-4 py-3 flex items-center justify-between"
              onClick={() => setExpandedRationale(expandedRationale === s.id ? null : s.id)}
            >
              <div className="flex items-center gap-3">
                <span className="font-headline font-bold text-primary">{s.label}</span>
                {s.recommended && (
                  <span className="font-mono text-[9px] tracking-widest uppercase bg-low text-low-foreground px-2 py-0.5">
                    RECOMMENDED
                  </span>
                )}
              </div>
              <span className="font-mono text-[10px] text-outline">
                {expandedRationale === s.id ? "▲" : "▼"}
              </span>
            </button>
            {expandedRationale === s.id && (
              <div className="px-4 pb-4 border-t border-outline-variant">
                <p className="font-body text-sm text-on-surface mt-3">{s.rationale}</p>
                {s.assumptions.length > 0 && (
                  <div className="mt-3">
                    <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-2">
                      ASSUMPTIONS
                    </p>
                    <ul className="space-y-1">
                      {s.assumptions.map((a, i) => (
                        <li key={i} className="font-body text-xs text-on-surface-variant flex gap-2">
                          <span className="text-outline">—</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
