import type { TransportMetrics } from "../transport/index.js";
export type HealthAlertCode = "SCHEMA_DRIFT" | "COVERAGE_DROP" | "STALE_DATA" | "PROVENANCE_GAP" | "SEC_ACCESS_FAILURES" | "QUEUE_PRESSURE";
export interface HealthAlert {
    code: HealthAlertCode;
    message: string;
}
export interface MonitoringStatement {
    values: Record<string, unknown>;
    coverage: {
        missingFields: string[];
    };
    audit: {
        complete: boolean;
        inputs: Array<{
            retrievedAt: string;
        }>;
    };
}
export interface HealthInput {
    metrics: TransportMetrics;
    errors?: Array<{
        code: string;
    }>;
    statements?: MonitoringStatement[];
    now?: Date;
}
export interface HealthThresholds {
    maxFailureRate?: number;
    minFailures?: number;
    maxQueueDepth?: number;
    minCoverage?: number;
    maxAgeMs?: number;
}
export declare function assessHealth(input: HealthInput, limits?: HealthThresholds): HealthAlert[];
