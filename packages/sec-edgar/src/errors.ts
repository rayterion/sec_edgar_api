export type EdgarErrorCode =
  | "INVALID_INPUT"
  | "INVALID_PATH"
  | "ABORTED"
  | "TIMEOUT"
  | "NETWORK"
  | "NETWORK_DNS"
  | "NETWORK_TLS"
  | "NETWORK_CONNECTION"
  | "DECOMPRESSION"
  | "REDIRECT"
  | "HTTP_400"
  | "HTTP_403"
  | "HTTP_404"
  | "HTTP_408"
  | "HTTP_429"
  | "HTTP_5XX"
  | "HTTP_UNEXPECTED"
  | "BLOCKED_HTML"
  | "CONTENT_TYPE"
  | "EMPTY_BODY"
  | "MALFORMED_JSON"
  | "MALFORMED_XML"
  | "SCHEMA"
  | "NOT_FOUND"
  | "MISSING_HISTORY"
  | "PRECISION"
  | "UNSUPPORTED"
  | "OVERSIZED";

export class EdgarError extends Error {
  readonly code: EdgarErrorCode;
  readonly url?: string;
  readonly status?: number;
  readonly retryable: boolean;
  override readonly cause?: unknown;
  constructor(
    code: EdgarErrorCode,
    message: string,
    context: {
      url?: string;
      status?: number;
      retryable?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "EdgarError";
    this.code = code;
    this.url = context.url;
    this.status = context.status;
    this.retryable = context.retryable ?? false;
    this.cause = context.cause;
  }
}
export function assertInput(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new EdgarError("INVALID_INPUT", message);
}
export function schema(
  condition: unknown,
  message: string,
  url?: string,
): asserts condition {
  if (!condition) throw new EdgarError("SCHEMA", message, { url });
}
