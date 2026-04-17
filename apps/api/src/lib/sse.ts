import { Response } from "express";
import { AgentEvent, AgentEventType } from "../types";

export class SSEStream {
  private heartbeatInterval: ReturnType<typeof setInterval>;

  constructor(private res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    this.heartbeatInterval = setInterval(() => {
      res.write(": ping\n\n");
    }, 15000);

    res.on("close", () => {
      clearInterval(this.heartbeatInterval);
    });
  }

  emit(event: AgentEvent): void {
    this.res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  close(): void {
    clearInterval(this.heartbeatInterval);
    this.res.write("data: [DONE]\n\n");
    this.res.end();
  }
}

export function emitAgent(
  stream: SSEStream,
  agent: string,
  type: AgentEventType,
  message: string,
  data?: unknown,
): void {
  stream.emit({
    type,
    agent,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}
