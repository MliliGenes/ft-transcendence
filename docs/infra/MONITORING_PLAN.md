# Local Monitoring for Nook

> **Status:** Phase A (the stack, dashboards, alert rules, log collection and redaction) is implemented. See [monitoring.md](monitoring.md). Phase B (HTTP and Socket.IO metrics in the services, structured JSON logs with request IDs) is still to do.

## Summary

Add an optional Grafana-based monitoring stack for **container resources, HTTP traffic, Socket.IO activity, searchable logs, PostgreSQL, and RabbitMQ**.

Keep everything local. No product analytics, chat-content inspection, or external telemetry services.

## Containers

| Container | Purpose |
|---|---|
| **Grafana** | One dashboard for metrics, logs, and service health |
| **Prometheus** | Stores historical metrics |
| **Loki** | Stores searchable container logs |
| **Grafana Alloy** | Collects logs, scrapes metrics, and runs database exporters and health probes |
| **cAdvisor** | Container CPU, memory, network, and filesystem metrics |
| **Docker socket proxy** | Restricts Docker API access used for log discovery |

Alloy supports collecting Docker telemetry into this stack; its embedded exporters avoid separate PostgreSQL and health-probe containers. [Grafana documentation](https://grafana.com/docs/alloy/latest/monitor/monitor-docker-containers/)

Skip Dozzle, Portainer, and Socket.IO Admin UI initially: Grafana covers the requested monitoring without adding overlapping interfaces or exposing chat payloads.

## Implementation

- **Deployment:** Add an optional `compose.monitoring.yaml`. Publish only Grafana at `127.0.0.1:3001`; keep collectors and storage endpoints internal. Provision dashboards and data sources automatically, pin image versions, and retain logs and metrics for seven days.
- **Container resources:** Isolate cAdvisor's required host access from Alloy and the dashboards. On Docker Desktop, monitor Linux containers and their VM—not the entire Windows host. Verify resource collection before proceeding.
- **Readable logs:** Use structured JSON for Nginx and the existing Nest logger. Include timestamp, service, severity, request ID, status, and duration. Configure Docker log rotation at 10 MB × three files.
- **Privacy:** Exclude bodies, passwords, cookies, authorization headers, OAuth/reset tokens, and signed URL query strings. Apply safe logging to both HTTPS listeners, including the storage gateway; sanitize collected error logs as well.
- **HTTP:** Instrument both Nest services with request counts, errors, duration histograms, and Node process metrics. Use bounded route-template labels rather than individual URLs. Expose metrics on an internal, unpublished listener—not through the public API.
- **Socket.IO:** Count active connections, connections/disconnections, authentication failures, and known incoming/outgoing events. Measure handler duration where applicable. Clearly distinguish server emissions from confirmed client delivery; do not log message contents.
- **Database and broker:** Monitor both PostgreSQL databases using dedicated monitoring accounts, without resetting existing data. Enable RabbitMQ's built-in Prometheus plugin for queue depth, unacknowledged messages, connections, and message rates. [RabbitMQ monitoring](https://www.rabbitmq.com/docs/monitoring)
- **Dashboard organization:** Provision Overview, HTTP/API, Chat Realtime, Databases/Broker, and Logs views. Initially monitor MinIO through health checks, container resources, gateway requests, and logs.
- **Configuration:** Document startup, shutdown, credentials, retention, and troubleshooting. Use the requested `VAR_NAME=<EXAMPLE_VALUE>` convention for new environment examples; preserve actual credentials.

The socket proxy will deny write operations and remain isolated. It reduces Docker API exposure but does not eliminate the sensitivity of container inspection or cAdvisor's host access. [Socket proxy documentation](https://github.com/Tecnativa/docker-socket-proxy)

## Validation and Defaults

- Validate both normal Compose startup and startup with the monitoring override.
- Compare container measurements against `docker stats`; verify logs and metrics survive monitoring-container restarts.
- Exercise successful/failed HTTP requests, socket reconnects, authentication failures, chat events, and media uploads.
- Confirm request IDs correlate gateway and backend logs without high-cardinality metric labels.
- Test secret redaction using synthetic credentials and signed URLs.
- Verify dashboards require authentication, internal endpoints are unreachable through Nginx, and Docker write operations are denied.
- Run affected backend tests, lint, and builds.
- Default to metrics and logs only; defer distributed tracing, external alert delivery, browser analytics, and production deployment.

**Implementation notes (phase A):** Grafana is served at `https://localhost/grafana/` through Nginx rather than on port 3001. Alert rules were added for module D02. cAdvisor must be 0.54.0 or newer to work with the containerd image store.
