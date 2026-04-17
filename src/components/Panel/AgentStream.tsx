import { useEffect, useRef } from "react";
import { AgentEvent } from "@/types";

interface AgentStreamProps {
  events: AgentEvent[];
  isRunning: boolean;
  isComplete: boolean;
}

function getEventStyle(type: AgentEvent["type"]): string {
  switch (type) {
    case "agent_start":
    case "agent_complete":
      return "text-primary font-medium";
    case "api_call":
      return "text-outline";
    case "api_result":
      return "text-low";
    case "conflict_detected":
      return "text-critical";
    case "scenario_scored":
      return "text-on-surface-variant";
    case "memo_ready":
      return "text-primary font-medium";
    case "error":
      return "text-critical font-medium";
    default:
      return "text-on-surface";
  }
}

function getEventPrefix(type: AgentEvent["type"]): string {
  switch (type) {
    case "agent_start": return "▶ ";
    case "agent_complete": return "✓ ";
    case "api_call": return "  ↗ ";
    case "api_result": return "  ← ";
    case "conflict_detected": return "⚠ ";
    case "scenario_scored": return "  ◈ ";
    case "memo_ready": return "✦ ";
    case "error": return "✗ ";
    default: return "  ";
  }
}

export function AgentStream({ events, isRunning, isComplete }: AgentStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  if (!isRunning && events.length === 0) return null;

  return (
    <div className="border-t border-outline-variant mt-4">
      <div className="px-6 py-3 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isRunning ? "bg-low animate-pulse" : isComplete ? "bg-low" : "bg-outline"
            }`}
          />
          <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
            {isRunning ? "ANALYSIS RUNNING" : isComplete ? "ANALYSIS COMPLETE" : "AGENT LOG"}
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="px-6 py-3 max-h-64 overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {events.length === 0 && isRunning && (
          <div className="flex items-center gap-1 py-1">
            <span className="font-mono text-[10px] text-outline animate-pulse">Initialising agents</span>
            <span className="font-mono text-[10px] text-outline animate-pulse">...</span>
          </div>
        )}

        {events.map((event, i) => (
          <div
            key={i}
            className={`font-mono text-[10px] py-1 border-b border-dashed border-outline-variant/40 ${getEventStyle(event.type)}`}
            style={{
              animationName: "fadeIn",
              animationDuration: "300ms",
              animationDelay: `${i * 40}ms`,
              animationFillMode: "both",
            }}
          >
            <span className="text-outline/60 mr-1">{event.agent.split("—")[0].trim()}</span>
            {getEventPrefix(event.type)}
            {event.message}
          </div>
        ))}

        {isComplete && (
          <div className="font-mono text-[10px] py-2 text-low font-medium">
            ✓ Pipeline complete — view results above
          </div>
        )}
      </div>
    </div>
  );
}
