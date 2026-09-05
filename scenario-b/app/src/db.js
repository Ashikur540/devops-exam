const { Pool } = require('pg');
const metrics = require('./metrics');

// pg.Pool() with no args already reads PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
// from env, so DATABASE_URL is only needed when we want a single connection string.
const pool = new Pool(
  process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : undefined
);

// Every query goes through here so we get duration + row-count metrics for
// free, and can count how many queries one HTTP request needed (N+1 detector).
async function query(req, queryName, text, params) {
  const endTimer = metrics.dbQueryDuration.startTimer({ query_name: queryName });
  const result = await pool.query(text, params);
  endTimer();
  metrics.dbRowsReturned.observe({ query_name: queryName }, result.rowCount);
  if (req) req.dbQueryCount = (req.dbQueryCount || 0) + 1;
  return result;
}

module.exports = { pool, query };
