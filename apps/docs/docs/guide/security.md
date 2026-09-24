# Security and fair access

The client sends requests only to approved HTTPS SEC hosts and paths. Archive document names are validated; redirects are rejected. JSON and document sizes are bounded. It does not execute filing content, accept arbitrary URLs, or download bulk ZIPs for company requests.

The default request rate is five requests per second per client with concurrency two. The [SEC says](https://www.sec.gov/about/developer-resources) the aggregate rate for a user across machines should not exceed ten per second. If several processes or machines share one organization identity, coordinate them with a shared limiter. Identify your organization and contact in `userAgent`. Retryable 408, 429, and 5xx responses use bounded retries and honor `Retry-After`. Pass `AbortSignal` through request options where supported.

The package is unofficial, public, and read-only. It does not access EDGAR Next submission or account APIs.
