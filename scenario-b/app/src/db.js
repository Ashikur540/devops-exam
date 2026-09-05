const { Pool } = require('pg');

// pg.Pool() with no args already reads PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
// from env, so DATABASE_URL is only needed when we want a single connection string.
module.exports = new Pool(
  process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : undefined
);
