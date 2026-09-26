export class EdgarError extends Error {
    code;
    url;
    status;
    retryable;
    cause;
    constructor(code, message, context = {}) {
        super(message);
        this.name = "EdgarError";
        this.code = code;
        this.url = context.url;
        this.status = context.status;
        this.retryable = context.retryable ?? false;
        this.cause = context.cause;
    }
}
export function assertInput(condition, message) {
    if (!condition)
        throw new EdgarError("INVALID_INPUT", message);
}
export function schema(condition, message, url) {
    if (!condition)
        throw new EdgarError("SCHEMA", message, { url });
}
