import { useState } from "react";
import { Action, ActionOwner } from "@/types";

interface ActionPlanProps {
  actions: Action[];
}

const OWNER_STYLES: Record<ActionOwner, string> = {
  partner: "bg-primary text-primary-foreground",
  associate: "bg-on-surface text-surface",
  "local-counsel": "bg-surface-high text-on-surface border border-outline-variant",
  client: "border border-primary text-primary",
};

const HORIZON_LABELS: Record<string, string> = {
  "0-30": "Days 0–30",
  "31-60": "Days 31–60",
  "61-90": "Days 61–90",
};

export function ActionPlan({ actions }: ActionPlanProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const horizons = ["0-30", "31-60", "61-90"] as const;

  return (
    <div className="space-y-10">
      {horizons.map((horizon) => {
        const group = actions.filter((a) => a.horizon === horizon);
        if (group.length === 0) return null;

        return (
          <div key={horizon}>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-headline text-lg font-bold text-primary">
                {HORIZON_LABELS[horizon]}
              </h3>
              <span className="font-mono text-[9px] tracking-widest uppercase bg-surface-highest text-on-surface px-2 py-0.5">
                {group.length} ACTIONS
              </span>
              {group.some((a) => a.blocking) && (
                <span className="font-mono text-[9px] tracking-widest uppercase bg-critical text-critical-foreground px-2 py-0.5">
                  ⚑ BLOCKING
                </span>
              )}
            </div>

            <div className="space-y-3">
              {group.map((action) => (
                <div
                  key={action.id}
                  className={`border ${action.blocking ? "border-critical" : "border-outline-variant"}`}
                >
                  <button
                    className="w-full px-5 py-4 flex items-start gap-4 text-left"
                    onClick={() => toggle(action.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {action.blocking && (
                          <span className="font-mono text-[9px] tracking-widest uppercase text-critical">
                            ⚑ BLOCKING
                          </span>
                        )}
                        <span className="font-body font-bold text-primary text-sm">{action.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 ${OWNER_STYLES[action.owner]}`}>
                          {action.owner}
                        </span>
                        <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                          ~{action.estimatedDays}d
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-outline shrink-0 mt-1">
                      {expanded.has(action.id) ? "▲" : "▼"}
                    </span>
                  </button>

                  {expanded.has(action.id) && (
                    <div className="px-5 pb-4 border-t border-outline-variant pt-3">
                      <p className="font-body text-sm text-on-surface">{action.description}</p>
                      {action.dependsOn.length > 0 && (
                        <div className="mt-2">
                          <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                            REQUIRES: {action.dependsOn.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {actions.length === 0 && (
        <div className="text-center py-16 text-outline font-mono text-[10px] tracking-widest uppercase">
          NO ACTIONS GENERATED
        </div>
      )}
    </div>
  );
}
