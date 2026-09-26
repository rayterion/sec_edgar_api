import { EdgarError } from "../errors.js";
export function waitWithSignal(ms, signal) {
    if (signal?.aborted)
        return Promise.reject(new EdgarError("ABORTED", "Request aborted"));
    return new Promise((resolve, reject) => {
        const timer = setTimeout(done, Math.max(0, ms));
        function abort() {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
            reject(new EdgarError("ABORTED", "Request aborted"));
        }
        function done() {
            signal?.removeEventListener("abort", abort);
            resolve();
        }
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted)
            abort();
    });
}
