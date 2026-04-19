import { useState, useEffect, useRef, useCallback } from "react";
import { AgentEvent } from "@/types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface UseAgentStreamResult {
  events: AgentEvent[];
  isRunning: boolean;
  isComplete: boolean;
  error: string | null;
  start: (sessionId: string) => void;
  reset: () => void;
}

export function useAgentStream(): UseAgentStreamResult {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setEvents([]);
    setIsRunning(false);
    setIsComplete(false);
    setError(null);
  }, []);

  const start = useCallback((sessionId: string) => {
    esRef.current?.close();
    setEvents([]);
    setIsRunning(true);
    setIsComplete(false);
    setError(null);

    const es = new EventSource(`${API_URL}/api/analysis/${sessionId}/stream`);
    esRef.current = es;

    es.onmessage = (e: MessageEvent<string>) => {
      const raw = e.data;
      if (raw === "[DONE]") {
        setIsRunning(false);
        setIsComplete(true);
        es.close();
        return;
      }
      try {
        const event = JSON.parse(raw) as AgentEvent;
        setEvents((prev) => [...prev, event]);
        if (event.type === "error") {
          setError(event.message);
          setIsRunning(false);
          es.close();
        }
      } catch {
        // ignore parse errors on heartbeat pings
      }
    };

    es.onerror = () => {
      setError("Connection to analysis stream lost");
      setIsRunning(false);
      es.close();
    };
  }, []);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  return { events, isRunning, isComplete, error, start, reset };
}

export async function startAnalysis(brief: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/analysis/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief }),
  });
  if (!res.ok) throw new Error(`Failed to start analysis: ${res.status}`);
  const { sessionId } = (await res.json()) as { sessionId: string };
  return sessionId;
}

export async function startDemoAnalysis(): Promise<string> {
  const res = await fetch(`${API_URL}/api/analysis/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Demo data not available: ${res.status}`);
  const { sessionId } = (await res.json()) as { sessionId: string };
  return sessionId;
}

export async function confirmTwin(sessionId: string, twin?: unknown): Promise<void> {
  await fetch(`${API_URL}/api/analysis/${sessionId}/twin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ twin }),
  });
}

export async function fetchResult(sessionId: string) {
  const res = await fetch(`${API_URL}/api/analysis/${sessionId}/result`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchTwin(sessionId: string) {
  const res = await fetch(`${API_URL}/api/analysis/${sessionId}/twin`);
  if (!res.ok) return null;
  return res.json() as Promise<{ twin: unknown; confirmed: boolean }>;
}
