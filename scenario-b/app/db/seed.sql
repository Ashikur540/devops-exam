-- Seed data: 5 tenants, 50,000 notes (uneven spread), 150,000 tags.
-- Run with: psql "$DATABASE_URL" -f db/seed.sql

INSERT INTO tenants (slug) VALUES
  ('acme'), ('globex'), ('initech'), ('umbrella'), ('soylent');

-- tenant 1 (acme) gets 30,000 notes; tenants 2-5 split the remaining 20,000 (~5,000 each)
INSERT INTO notes (tenant_id, title, body)
SELECT
  CASE WHEN g <= 30000 THEN 1 ELSE 2 + (g % 4) END,
  'Note ' || g,
  md5(random()::text) || ' ' || md5(random()::text)
FROM generate_series(1, 50000) g;

INSERT INTO tags (note_id, name)
SELECT
  (random() * 49999 + 1)::int,
  (ARRAY['work','personal','urgent','idea','todo','draft','archive','important','followup','misc'])[floor(random() * 10 + 1)::int]
FROM generate_series(1, 150000) g;
