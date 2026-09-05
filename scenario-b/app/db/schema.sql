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
