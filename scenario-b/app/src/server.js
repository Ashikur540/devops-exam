const express = require('express');
const db = require('./db');

const app = express();
app.use(express.json());

app.get('/healthz', (req, res) => res.sendStatus(200));

app.get('/readyz', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(503);
  }
});

async function tenantMiddleware(req, res, next) {
  const slug = req.header('X-Tenant');
  if (!slug) return res.status(400).json({ error: 'X-Tenant header required' });
  try {
    const result = await db.query('SELECT id FROM tenants WHERE slug=$1', [slug]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'unknown tenant' });
    req.tenantId = result.rows[0].id;
    next();
  } catch (err) {
    res.status(500).json({ error: 'db error' });
  }
}

app.use('/api', tenantMiddleware);

app.post('/api/notes', async (req, res) => {
  const { title, body } = req.body;
  const result = await db.query(
    'INSERT INTO notes (tenant_id, title, body) VALUES ($1,$2,$3) RETURNING *',
    [req.tenantId, title, body]
  );
  res.status(201).json(result.rows[0]);
});

// GET /api/notes — DELIBERATELY BAD, keep it this way (N+1 query + unbounded limit).
// Do not fix — this is Problem 1 / Problem 4, found and reasoned about in B3.
app.get('/api/notes', async (req, res) => {
  const tenantId = req.tenantId;
  const limit = req.query.limit || 20;
  const page = req.query.page || 1;
  const offset = (page - 1) * limit;

  const notes = await db.query(
    'SELECT * FROM notes WHERE tenant_id=$1 ORDER BY id LIMIT $2 OFFSET $3',
    [tenantId, limit, offset]
  ); // 1 query

  for (const note of notes.rows) {
    // then N more queries
    const tags = await db.query('SELECT name FROM tags WHERE note_id=$1', [note.id]);
    note.tags = tags.rows.map((t) => t.name);
  }

  res.json(notes.rows);
});

app.get('/api/notes/:id', async (req, res) => {
  const result = await db.query(
    'SELECT * FROM notes WHERE id=$1 AND tenant_id=$2',
    [req.params.id, req.tenantId]
  );
  if (result.rows.length === 0) return res.sendStatus(404);

  const note = result.rows[0];
  const tags = await db.query('SELECT name FROM tags WHERE note_id=$1', [note.id]);
  note.tags = tags.rows.map((t) => t.name);
  res.json(note);
});

// Problem 2 — unindexed search: LIKE '%q%' forces a full table scan.
app.get('/api/search', async (req, res) => {
  const q = req.query.q || '';
  const result = await db.query(
    "SELECT id, title, body FROM notes WHERE tenant_id=$1 AND body LIKE '%' || $2 || '%'",
    [req.tenantId, q]
  );
  res.json(result.rows);
});

// Problem 3 — no index on tags.note_id makes this join slow at scale.
app.get('/api/stats', async (req, res) => {
  const result = await db.query(
    `SELECT t.slug,
            COUNT(DISTINCT n.id) AS notes,
            COUNT(tg.id) AS tags
     FROM tenants t
     LEFT JOIN notes n ON n.tenant_id = t.id
     LEFT JOIN tags tg ON tg.note_id = n.id
     WHERE t.id = $1
     GROUP BY t.slug`,
    [req.tenantId]
  );
  res.json(result.rows[0] || {});
});

const PORT = process.env.PORT || 3000;

// Fail fast if the DB isn't reachable yet — this is what exposes the
// `depends_on` (container started) vs "ready" (accepting queries) gap.
(async () => {
  try {
    await db.query('SELECT 1');
  } catch (err) {
    console.error('startup DB check failed:', err.message);
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`listening on ${PORT}`));
})();
