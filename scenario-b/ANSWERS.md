# Scenario B — Containerize, Ship and Observe — Answers

Exam token used in this scenario's screenshots: `PASTE_TOKEN`

## B1 — Docker image (Tasks 21-25)

### Task 21 — Multi-stage Dockerfile
Builder stage (`node:20-alpine`) installs prod-only deps (`npm ci --omit=dev`); final stage copies just `node_modules`, `package.json`, `src` — no npm cache, no lockfile, no build tools. Runs as the `node` user (built into the base image, no need to create one). `HEALTHCHECK` uses `wget --spider` against `/healthz` (busybox `wget` already ships in alpine, no extra package needed).

Verified locally: `whoami` → `node` (not root), `id` → `uid=1000(node)`, container status shows `(healthy)` after ~12s.

### Task 22 — Size comparison
Removed going from naive → multi-stage:
- Full Debian-based `node:20` image → `node:20-alpine`
- `npm install` (installs devDependencies) → `npm ci --omit=dev` (prod-only, reproducible from lockfile)
- Build-stage-only files (npm cache, `package-lock.json`, anything not under `src/`) never copied into the final stage

What we gave up: convenience tools that come with the full Debian image (bash extras, apt, easy `apt install` for ad-hoc debugging inside the container) — for a production image that's an acceptable trade, since debugging should happen via logs/exec into a separate debug image, not by installing tools into the running container.

Naive size: **1.59GB**  Multi-stage size: **200MB** — **~87% smaller** (target was ≥60%).

### Task 23 — Layer caching
Changed one comment line in `src/server.js`, reran `docker build`. `COPY package*.json` and `RUN npm ci --omit=dev` stayed `CACHED` (their inputs — `package.json`/`package-lock.json` — didn't change). Only `COPY src ./src` (in both the builder and final stage) re-ran, because that layer's input is the source tree we just touched. This is why `package*.json` is copied and installed *before* `COPY src` — dependency installs are the expensive step and should only re-run when dependencies actually change.

### Task 24 — Biggest layer
Biggest layer overall is **130MB**, from the base `node:20-alpine` image itself (`addgroup/adduser` + Node.js binary install via `apk`/curl) — this is inherited from the official image, not something our Dockerfile creates. Of the layers our own Dockerfile adds, the biggest is `COPY node_modules` at **5.61MB**. Could it be smaller? Only by trimming dependencies further (we only depend on `express`+`pg`, already minimal) or switching to a smaller base like `node:20-alpine` → a distroless Node image, which trades away shell/package-manager access entirely.

### Task 25 — Secrets in image layers
Built a throwaway `Dockerfile.secrets-trap` reproducing the exact trap (`COPY .env` → `cat` → `rm`). Confirmed two things:
1. Inside the final container, `find / -name ".env"` returns **nothing** — looks clean.
2. Exported the image (`docker save` → OCI tar), searched the individual layer blobs, and found `.env` still present with its full plaintext (`DB_PASSWORD=supersecret12345`, `API_KEY=...`) inside the `COPY .env` layer's blob.

Why `rm` doesn't help: each Dockerfile instruction creates its own immutable layer (image = a stack of layer diffs). `rm` in a later layer only adds a "this file is deleted" marker (a whiteout) on top — it doesn't rewrite or delete the earlier layer's data. Anyone who pulls the image gets every layer, including the one with the secret, and can extract it directly without ever running the container. The real fix: never `COPY` secrets into a build context at all — use build secrets (`docker build --secret`) or inject at runtime via env vars/mounted volumes.

---

## B2 — Compose, storage, debugging (Tasks 26-28)

### Task 26 — depends_on vs actually ready
`docker-compose.broken.yml` uses plain `depends_on: [postgres]` — only waits for the postgres *container* to start, not for Postgres to actually accept connections. On a fresh volume, the app tried its startup DB check immediately and exited: `startup DB check failed: connect ECONNREFUSED ...:5432` (container status `Exited (1)`).

`docker-compose.yml` (fixed) adds a `healthcheck: pg_isready` on postgres and `depends_on: postgres: condition: service_healthy` on the app — Compose now waits for postgres to report healthy before even starting the app container. Result: app started cleanly, `listening on 3000`, `/healthz` and `/readyz` both 200 on first try, no crash.

### Task 27 — Volumes and persistence
Postgres data lives in the named volume `ashik-notes-pgdata`, not in the container's writable layer. `docker compose down` (no `-v`) only removes containers/network — the volume stays, so a note created before `down` was still there (with its original `id`/`created_at`) right after `up` again.

`docker compose down -v` additionally deletes the named volume itself — Postgres came back up completely empty (not even the schema existed, so the API returned `500` instead of `404`, since the tables themselves were gone, not just the row).

Backup/restore: took a `pg_dump -F c` before the `-v` wipe, then after the fresh volume came up, reloaded `schema.sql` and ran `pg_restore` from the dump — the same note (`id=1`, same `created_at`) came back exactly as it was.

### Task 28 — Debugging drill (2 marks each)

**a. Exit code 137**
- What you changed to cause it: ran a container with `--memory=50m` and had it allocate a huge array (`python -c "x=[0]*100000000"`).
- Symptom: process killed, exit code `137`.
- Command that revealed the cause: `docker inspect --format='{{.State.OOMKilled}}' <container>` → `true`. `137 = 128 + 9` (SIGKILL) — combined with `OOMKilled: true` that's the kernel's OOM killer, not the app crashing on its own (which would look like a normal non-zero exit, and a graceful stop asked via SIGTERM would show `143` instead).
- Fix: raise the memory limit to what the workload actually needs, or fix the code causing unbounded memory growth — a limit is a safety net, not something to just keep raising.

**b. Can't reach DB by service name, can by IP**
- What you changed to cause it: ran a plain `busybox` container via `docker run` (default bridge network) while postgres lives on the compose project's own `docker_default` network — two different Docker networks.
- Symptom: `nslookup postgres` from the busybox container → `NXDOMAIN`.
- Command that revealed the cause: `docker network ls` (showed `docker_default` as a separate network from `bridge`), `docker inspect <container> --format '{{json .NetworkSettings.Networks}}'`.
- Fix: put both containers on the same user-defined network (`docker network connect docker_default <container>`, or just let compose manage both — which is what our real `docker-compose.yml` already does).
- Note: on this Mac (Docker Desktop) even a raw IP connection across the two networks timed out — Docker Desktop's networking isolates user-defined bridges from each other more strictly than a plain Linux Docker Engine typically does, so "DNS fails, IP works" (as worded in the task) didn't fully reproduce here. Re-verified this drill against the real Linux Docker on the VPS for final evidence, where standard bridge routing applies.

**c. Volume mounted but app sees empty directory**
- What you changed to cause it: added a bind mount `./ashik-empty-folder:/app/node_modules` on the app service — an empty host folder over the path where the image already has `node_modules` installed.
- Symptom: `require('express')` → `Error: Cannot find module 'express'` / `MODULE_NOT_FOUND`.
- Command that revealed the cause: `docker run ... ls -la /app/node_modules` → empty directory (just `.` and `..`).
- Fix: don't bind-mount over a path the image populates — mount the source code directory instead (e.g. `./src:/app/src`) and let `node_modules` come from the image, or use a named volume seeded via an entrypoint step if you truly need host-editable deps.
- How do named volumes behave differently on first creation? A **bind mount** always shows exactly what's on the host (empty folder → empty mount, hiding the image's contents). A **named volume** that has never been used before is initialized by Docker with a *copy* of whatever was already at that path in the image — so `- node_modules:/app/node_modules` (named volume, first run) would actually preserve the image's installed packages, while the bind mount above wipes them out of view.

**d. Port published but connection refused from host**
- What you changed to cause it: changed `app.listen(PORT, ...)` to `app.listen(PORT, '127.0.0.1', ...)` — binds only to the loopback interface inside the container instead of all interfaces.
- Symptom: `docker ps` shows the port mapping fine (`0.0.0.0:8377->3000/tcp`), but `curl http://localhost:8377/healthz` from the host fails (`Connection reset by peer`), while `docker exec <container> wget -qO- http://127.0.0.1:3000/healthz` from *inside* the container returns `OK`.
- Command that revealed the cause: comparing the curl-from-host result against `docker exec ... wget 127.0.0.1:...` — same app, different reachability depending on which network namespace you're in.
- Fix: bind to `0.0.0.0` (or omit the host argument — Node's `http.Server.listen(port)` already defaults to all interfaces). Docker's port publishing forwards host traffic to the container's own network interface, not to its loopback, so an app listening only on `127.0.0.1` inside the container is unreachable from outside no matter what port mapping is configured.

---

## B3 — Prometheus + Grafana (Tasks 29-34)

### Task 29 — Metrics
_(evidence: `curl :3000/metrics | head -50`)_

### Task 30 — Prometheus wired up
_(evidence: targets page showing app UP, a query returning data)_

### Task 31 — Load generation
_(load script in this folder, tool summary output)_

### Task 32 — Dashboard (`exam-<TOKEN>`) — PromQL per panel

**Panel A — Top 5 slowest endpoints (p95)**
PromQL: `...`

**Panel B — Endpoint consuming most TOTAL time**
PromQL: `...`
Which endpoint wins Panel A vs Panel B, and why are they different?

> 

**Panel C — Avg + p99 DB query duration by query name**
PromQL: `...`

**Panel D — Slowest single query + frequency**
PromQL: `...`
Which query is slowest — is it also the most frequent?

> 

**Panel E — N+1 detector (queries per request)**
PromQL: `...`

**Panel F — Harmful queries over time (threshold)**
PromQL: `...`
Threshold chosen and why (base it on your own Panel C data, not a round number):

> 

**Panel G — Rows returned distribution**
PromQL: `...`
What max limit would you set, and what should the API do when a client asks for more?

> 

**Panel H — Error rate + p95 latency by tenant**
PromQL: `...`
Which tenant looks worse, and is it more data or heavier requests? Prove it.

> 

**Panel I — In-flight requests vs latency (saturation)**
PromQL: `...`
Did latency rise at the same time as concurrency, or was there a delay? What does that tell you about the bottleneck?

> 

_(dashboard JSON exported to `scenario-b/grafana/dashboard.json`)_

### Task 33 — Alert
Threshold chosen and why (base on your normal p95 from Panel A):

> 

`for` duration chosen — what happens with `for: 0s`, what problem does a longer `for` solve?

> 

### Task 34 — Fix one problem
Which problem did you fix?

> 

`EXPLAIN ANALYZE` before/after — see evidence/.
What did the fix cost (index size / write speed measured)?

> 

Which problem would you fix next, and what would you need to measure first?

> 

---

## B4 — Docker Swarm (Tasks 35-40)

### Task 35 — Deploy stack
One node or more?

> 

### Task 36 — Scale to 5, prove with hostnames
_(evidence: 5 distinct `X-Served-By` hostnames)_

### Task 37 — Rolling update, zero downtime
Failure count from `update-log.txt`. If any non-200s, explain honestly why:

> 

### Task 38 — Break v3, rollback
How long from deploy command to full rollback (from `docker service ps` timestamps)?

> 

What would've happened with no healthcheck at all — would Swarm have noticed?

> 

### Task 39 — Limits vs reservations
What did you observe, and how does limit differ from reservation?

> 

### Task 40 — Scale down during live traffic
Failure count:

> 

---

## B5 — CI/CD (Tasks 41-46)

### Task 41 — PR pipeline
Failed run link:
Passed run link:

### Task 42 — Caching
Cold run duration: ___  Warm run duration: ___  Improvement:

> 

### Task 43 — Main branch pipeline
Multi-arch build — did you do it? If not, why might you want it?

> 

### Task 44 — Deploy with approval gate
_(evidence: paused workflow, approved deploy, VPS running new image tag)_

### Task 45 — Break the pipeline 3 ways
1. Failing test — run link:
2. Build error — run link:
3. Deploy failure — run link:

What in your setup made the failed deploy safe? What would've happened with `docker service rm` + recreate instead?

> 

### Task 46 — One safeguard
Which one (concurrency group / job timeout), and what specific incident does it prevent?

> 
