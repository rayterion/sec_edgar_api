export function assessHealth(input, limits = {}) {
    const alerts = [];
    const failures = input.metrics.failures;
    if (failures >= (limits.minFailures ?? 3) &&
        failures / Math.max(1, input.metrics.requests) >
            (limits.maxFailureRate ?? 0.2))
        alerts.push({
            code: "SEC_ACCESS_FAILURES",
            message: "Repeated SEC requests failed in this measurement window",
        });
    if (input.metrics.queueDepth > (limits.maxQueueDepth ?? 32))
        alerts.push({
            code: "QUEUE_PRESSURE",
            message: "SEC request queue exceeds the configured depth",
        });
    if (input.errors?.some((error) => ["SCHEMA", "MALFORMED_JSON", "CONTENT_TYPE", "MALFORMED_XML"].includes(error.code)))
        alerts.push({
            code: "SCHEMA_DRIFT",
            message: "A SEC response failed the expected schema or content contract",
        });
    const now = (input.now ?? new Date()).getTime();
    for (const statement of input.statements ?? []) {
        const count = Object.keys(statement.values).length;
        if (count > 0 &&
            1 - statement.coverage.missingFields.length / count <
                (limits.minCoverage ?? 0.8))
            addOnce(alerts, "COVERAGE_DROP", "A statement fell below the configured canonical-field coverage");
        if (!statement.audit.complete)
            addOnce(alerts, "PROVENANCE_GAP", "A statement lacks complete response provenance");
        if (statement.audit.inputs.some((source) => !Number.isFinite(Date.parse(source.retrievedAt)) ||
            now - Date.parse(source.retrievedAt) >
                (limits.maxAgeMs ?? 86_400_000)))
            addOnce(alerts, "STALE_DATA", "A statement input exceeds the configured retrieval age");
    }
    return alerts;
}
function addOnce(alerts, code, message) {
    if (!alerts.some((alert) => alert.code === code))
        alerts.push({ code, message });
}
