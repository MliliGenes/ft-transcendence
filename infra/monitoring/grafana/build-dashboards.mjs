// Generates the provisioned Grafana dashboards in ./dashboards/.
// Edit the panel lists below, then run:  node infra/monitoring/grafana/build-dashboards.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "dashboards");
const PROM = { type: "prometheus", uid: "prometheus" };
const LOKI = { type: "loki", uid: "loki" };
const SERVICE = "container_label_com_docker_compose_service";

let nextId = 1;
const grid = { x: 0, y: 0, rowH: 0 };
function place(w, h) {
  if (grid.x + w > 24) { grid.x = 0; grid.y += grid.rowH; grid.rowH = 0; }
  const pos = { x: grid.x, y: grid.y, w, h };
  grid.x += w; grid.rowH = Math.max(grid.rowH, h);
  return pos;
}

const targets = (ds, list) => list.map(([expr, legendFormat], i) => ({ datasource: ds, refId: String.fromCharCode(65 + i), expr, legendFormat }));

function timeseries(title, exprs, { unit = "short", w = 12, h = 8, description, stack = false } = {}) {
  return {
    id: nextId++, type: "timeseries", title, description, datasource: PROM, gridPos: place(w, h),
    targets: targets(PROM, exprs),
    fieldConfig: { defaults: { unit, custom: { lineWidth: 1, fillOpacity: stack ? 20 : 8, stacking: { mode: stack ? "normal" : "none" } } }, overrides: [] },
    options: { legend: { displayMode: "list", placement: "bottom" }, tooltip: { mode: "multi" } },
  };
}

function stat(title, expr, { unit = "short", w = 6, h = 4, mappings, thresholds, legendFormat = "" , description} = {}) {
  return {
    id: nextId++, type: "stat", title, description, datasource: PROM, gridPos: place(w, h),
    targets: targets(PROM, [[expr, legendFormat]]),
    fieldConfig: { defaults: { unit, mappings: mappings ?? [], thresholds: thresholds ?? { mode: "absolute", steps: [{ color: "green", value: null }] } }, overrides: [] },
    options: { colorMode: "background", graphMode: "none", reduceOptions: { calcs: ["lastNotNull"], fields: "", values: false }, textMode: "value_and_name" },
  };
}

const upDown = [{ type: "value", options: { 0: { text: "DOWN", color: "red" }, 1: { text: "UP", color: "green" } } }];
const redGreen = { mode: "absolute", steps: [{ color: "red", value: null }, { color: "green", value: 1 }] };

function logsPanel(title, expr, { w = 24, h = 14 } = {}) {
  return {
    id: nextId++, type: "logs", title, datasource: LOKI, gridPos: place(w, h),
    targets: targets(LOKI, [[expr, ""]]),
    options: { showTime: true, wrapLogMessage: true, sortOrder: "Descending", enableLogDetails: true },
  };
}

function alertList(title, { w = 24, h = 6 } = {}) {
  return {
    id: nextId++, type: "alertlist", title, gridPos: place(w, h),
    options: { alertListOptions: { stateFilter: { firing: true, pending: true }, viewMode: "list" }, alertInstanceLabelFilter: "", datasource: "Prometheus", groupMode: "default", maxItems: 20, showInstances: true, sortOrder: 1, stateFilter: { firing: true, pending: true, normal: false, error: true, noData: false }, viewMode: "list" },
  };
}

function text(title, content, { w = 24, h = 5 } = {}) {
  return { id: nextId++, type: "text", title, gridPos: place(w, h), options: { mode: "markdown", content } };
}

function dashboard(uid, title, description, panels, { templating = [] } = {}) {
  const d = {
    uid, title, description, tags: ["nook"], editable: false, schemaVersion: 39, version: 1,
    time: { from: "now-1h", to: "now" }, refresh: "30s", timezone: "browser",
    templating: { list: templating }, annotations: { list: [] }, panels,
  };
  nextId = 1; grid.x = 0; grid.y = 0; grid.rowH = 0;
  return d;
}

const serviceVar = {
  name: "service", label: "Service", type: "query", datasource: LOKI,
  query: { label: "service", stream: '{project="nook"}', type: 1, refId: "service" },
  definition: 'label_values({project="nook"}, service)', includeAll: true, multi: true, current: { text: "All", value: "$__all" }, refresh: 2,
};

// ---------------------------------------------------------------- dashboards
const dashboards = [];

dashboards.push(dashboard("nook-overview", "Nook / Overview", "Service health, firing alerts and container resources at a glance.", [
  stat("Gateway (nginx)", 'probe_success{service="nginx"}', { mappings: upDown, thresholds: redGreen, w: 4 }),
  stat("Client", 'probe_success{service="client"}', { mappings: upDown, thresholds: redGreen, w: 4 }),
  stat("User service", 'probe_success{service="user-service"}', { mappings: upDown, thresholds: redGreen, w: 4 }),
  stat("Chat service", 'probe_success{service="chat-service"}', { mappings: upDown, thresholds: redGreen, w: 4 }),
  stat("MinIO", 'probe_success{service="minio"}', { mappings: upDown, thresholds: redGreen, w: 4 }),
  stat("Databases up", "sum(pg_up)", { w: 4, description: "Number of reachable PostgreSQL databases (expected: 2).", thresholds: { mode: "absolute", steps: [{ color: "red", value: null }, { color: "orange", value: 1 }, { color: "green", value: 2 }] } }),
  alertList("Firing and pending alerts", { h: 6 }),
  timeseries("CPU by service", [[`sum by (${SERVICE}) (rate(container_cpu_usage_seconds_total{${SERVICE}!=""}[1m]))`, `{{${SERVICE}}}`]], { unit: "percentunit" }),
  timeseries("Memory by service", [[`sum by (${SERVICE}) (container_memory_working_set_bytes{${SERVICE}!=""})`, `{{${SERVICE}}}`]], { unit: "bytes" }),
  timeseries("Probe response time", [["probe_duration_seconds", "{{service}}"]], { unit: "s", w: 24 }),
]));

dashboards.push(dashboard("nook-containers", "Nook / Containers", "Per-container CPU, memory, network and filesystem from cAdvisor.", [
  timeseries("CPU", [[`sum by (${SERVICE}) (rate(container_cpu_usage_seconds_total{${SERVICE}!=""}[1m]))`, `{{${SERVICE}}}`]], { unit: "percentunit" }),
  timeseries("Memory (working set)", [[`sum by (${SERVICE}) (container_memory_working_set_bytes{${SERVICE}!=""})`, `{{${SERVICE}}}`]], { unit: "bytes" }),
  timeseries("Network received", [[`sum by (${SERVICE}) (rate(container_network_receive_bytes_total{${SERVICE}!=""}[1m]))`, `{{${SERVICE}}}`]], { unit: "Bps" }),
  timeseries("Network sent", [[`sum by (${SERVICE}) (rate(container_network_transmit_bytes_total{${SERVICE}!=""}[1m]))`, `{{${SERVICE}}}`]], { unit: "Bps" }),
  timeseries("Filesystem writes", [[`sum by (${SERVICE}) (rate(container_fs_writes_bytes_total{${SERVICE}!=""}[1m]))`, `{{${SERVICE}}}`]], { unit: "Bps" }),
  timeseries("Container restarts (15m)", [[`changes(container_start_time_seconds{${SERVICE}!=""}[15m])`, `{{${SERVICE}}}`]]),
]));

dashboards.push(dashboard("nook-data", "Nook / Databases & Broker", "PostgreSQL (user-db, chat-db) and RabbitMQ health.", [
  stat("user-db", 'pg_up{database="user-db"}', { mappings: upDown, thresholds: redGreen, w: 6 }),
  stat("chat-db", 'pg_up{database="chat-db"}', { mappings: upDown, thresholds: redGreen, w: 6 }),
  stat("RabbitMQ connections", "sum(rabbitmq_connections)", { w: 6 }),
  stat("Messages waiting", "sum(rabbitmq_detailed_queue_messages_ready)", { w: 6, thresholds: { mode: "absolute", steps: [{ color: "green", value: null }, { color: "orange", value: 50 }, { color: "red", value: 100 }] } }),
  timeseries("Postgres connections", [["sum by (database, state) (pg_stat_activity_count)", "{{database}} {{state}}"]]),
  timeseries("Postgres transactions/s", [["sum by (database) (rate(pg_stat_database_xact_commit[1m]))", "{{database}} commits"], ["sum by (database) (rate(pg_stat_database_xact_rollback[1m]))", "{{database}} rollbacks"]]),
  timeseries("Database size", [['sum by (database) (pg_database_size_bytes{datname!~"template.*|postgres"})', "{{database}}"]], { unit: "bytes" }),
  timeseries("Deadlocks", [["sum by (database) (increase(pg_stat_database_deadlocks[5m]))", "{{database}}"]]),
  timeseries("Queue depth", [["sum by (queue) (rabbitmq_detailed_queue_messages_ready)", "{{queue}} ready"], ["sum by (queue) (rabbitmq_detailed_queue_messages_unacked)", "{{queue}} unacked"]]),
  timeseries("Message rates", [["sum(rate(rabbitmq_global_messages_received_total[1m]))", "published"], ["sum(rate(rabbitmq_global_messages_delivered_total[1m]))", "delivered"], ["sum(rate(rabbitmq_global_messages_acknowledged_total[1m]))", "acknowledged"]], { unit: "ops" }),
]));

dashboards.push(dashboard("nook-logs", "Nook / Logs", "Searchable container logs (secrets are redacted by Alloy before storage).", [
  timeseries("Error lines per service", [['sum by (service) (count_over_time({project="nook", service=~"$service"} |~ "(?i)(error|exception|fatal)" [1m]))', "{{service}}"]], { w: 24, h: 7 }),
  logsPanel("Logs", '{project="nook", service=~"$service"}', { h: 18 }),
].map(p => (p.type === "timeseries" ? { ...p, datasource: LOKI, targets: p.targets.map(t => ({ ...t, datasource: LOKI })) } : p)), { templating: [serviceVar] }));

dashboards.push(dashboard("nook-http-realtime", "Nook / HTTP & Realtime", "Gateway and service availability. Request and Socket.IO metrics arrive in phase B.", [
  text("About this dashboard", "Phase A shows availability and latency from health probes. **Phase B** adds per-route HTTP request counts, error rates and latency from both NestJS services, plus Socket.IO connections and events from chat-service. See `docs/infra/MONITORING_PLAN.md`."),
  timeseries("Probe success", [["probe_success", "{{service}}"]], { unit: "percentunit" }),
  timeseries("Probe response time", [["probe_duration_seconds", "{{service}}"]], { unit: "s" }),
  timeseries("HTTP status from probes", [["probe_http_status_code", "{{service}}"]], { w: 24 }),
]));

mkdirSync(OUT, { recursive: true });
for (const d of dashboards) writeFileSync(join(OUT, `${d.uid}.json`), JSON.stringify(d, null, 2) + "\n");
console.log(`wrote ${dashboards.length} dashboards to ${OUT}`);
