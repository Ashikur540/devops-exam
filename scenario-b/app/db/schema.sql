CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL       -- e.g. 'acme', 'globex'
);

CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Deliberately no index on tags.note_id — Problem 3, needed for B3.
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  note_id INT NOT NULL REFERENCES notes(id),
  name TEXT NOT NULL
);

-- C3 — maps an opaque attachment id to its S3 key + owning tenant, so a
-- download-url request can be checked against the requester's tenant before
-- anything gets signed (Task 58).
CREATE TABLE attachments (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  s3_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
