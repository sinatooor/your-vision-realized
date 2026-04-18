export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = "APP_ERROR", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(`${fallbackMessage}: ${error.message}`, 502, "UPSTREAM_ERROR", {
      upstreamMessage: error.message,
    });
  }

  return new AppError(fallbackMessage, 502, "UPSTREAM_ERROR");
}
