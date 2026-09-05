const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['route', 'method', 'status', 'tenant'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['route', 'method', 'tenant'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// query_name identifies WHICH query, not which row was touched -
// keeps cardinality fixed regardless of how much data exists.
const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'DB query duration in seconds',
  labelNames: ['query_name'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// This is the N+1 detector: /api/notes should show ~21, everything else ~1-2.
const dbQueriesPerRequest = new client.Histogram({
  name: 'db_queries_per_request',
  help: 'Number of DB queries made to serve one HTTP request',
  labelNames: ['route'],
  buckets: [0, 1, 2, 3, 5, 10, 15, 20, 25, 30, 50],
  registers: [register],
});

const dbRowsReturned = new client.Histogram({
  name: 'db_rows_returned',
  help: 'Rows returned per DB query',
  labelNames: ['query_name'],
  buckets: [0, 1, 5, 20, 50, 100, 500, 1000, 5000, 10000],
  registers: [register],
});

const httpRequestsInFlight = new client.Gauge({
  name: 'http_requests_in_flight',
  help: 'HTTP requests currently being handled',
  registers: [register],
});

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  dbQueryDuration,
  dbQueriesPerRequest,
  dbRowsReturned,
  httpRequestsInFlight,
};
