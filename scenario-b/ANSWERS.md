# Scenario B — Containerize, Ship and Observe — Answers

Exam token used in this scenario's screenshots: `ashik-devops-vmi3536696-1788500224-d4790b52`

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

Naive size: **1.6GB**  Multi-stage size: **207MB** — **~87% smaller** (target was ≥60%). (Dev-machine test earlier showed 1.59GB/200MB; VPS numbers above are the official evidence.)

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
- What you changed to cause it: ran a plain `busybox` container via `docker run` (lands on the default `bridge` network) while postgres runs in our compose project's own `ashik-notes-b_default` network — two different Docker networks, exactly as the task suggests trying.
- Symptom: `nslookup ashik-notes-postgres` from the busybox container → `NXDOMAIN`.
- Command that revealed the cause: `docker network ls` (many separate networks listed, one per project/student on this shared VPS — `ashik-notes-b_default` is its own, distinct from `bridge`), `docker inspect <container> --format '{{index .NetworkSettings.Networks "ashik-notes-b_default" "IPAddress"}}'` (note: `docker inspect`'s Go template needs `index ... "key"` instead of dot-access when the network name itself contains hyphens, like ours does — `.Networks.ashik-notes-b_default` fails to parse).
- **Real finding on this VPS (Docker 29.7.2):** a raw IP connection (`nc -zv <ip> 5432`) across the two networks also timed out — not just the DNS lookup. This contradicts the task's own wording ("ping the IP works"), which describes older Docker behavior. Current Docker isolates the default `bridge` network from user-defined networks at the routing level too, not only at DNS — verified identically on both this VPS and a separate Mac Docker Desktop test, so it's a real current-Docker behavior change, not an environment quirk.
- Fix: `docker network connect ashik-notes-b_default <container>` — put both containers on the same network. Verified after: `nslookup` now resolves `ashik-notes-postgres` to its IP, and the same `nc` command that timed out before now reports the port `open`.

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
Used `prom-client`. All 6 required metrics wired: `http_requests_total`, `http_request_duration_seconds`, `db_query_duration_seconds`, `db_queries_per_request`, `db_rows_returned`, `http_requests_in_flight`.

`route` label always uses the Express route *pattern* (`req.route.path`, e.g. `/api/notes/:id`), read in the response `finish` handler after Express has matched the route — never the raw URL, to avoid one series per note ID.

Every `db.query()` call now goes through a wrapped `query(req, queryName, sql, params)` in `db.js` that records duration + row count under `queryName`, and increments a per-request counter used for `db_queries_per_request`. Verified locally: `/api/notes?limit=5` → `db_queries_per_request_sum{route="/api/notes"} 7` (1 tenant lookup + 1 page query + 5 tag lookups) vs `/api/search` and `/api/stats` → `2` each — the N+1 is directly visible in the numbers already, before any dashboard.

### Task 30 — Prometheus wired up
Added to `docker-compose.yml`, config mounted from `prometheus.yml` (scrapes `app:3000` every 5s). Confirmed via API: `GET /api/v1/targets` → `{"job": "ashik-notes-app", "health": "up"}`, and `GET /api/v1/query?query=up` → returns a real sample (`value: 1`).

### Task 31 — Load generation
`loadtest.sh` — 300s baseline across all 5 seeded tenants hitting every endpoint (`/api/notes`, `/api/search`, `/api/stats`, `/api/notes/1`), a 30s heavier burst fired at the midpoint, and `acme` deliberately sent `?limit=5000` on top of its normal traffic throughout.

Found and fixed a real bug in the script itself: the first run had no `--max-time` on any `curl` call, so once the DB connection pool saturated during the burst, requests queued up faster than they completed — the shell hit its process/fork limit (`fork: Resource temporarily unavailable`) and left ~128 orphaned `curl` processes still queued against the server after the script had already crashed. Added `--max-time 10` to every call and reduced burst concurrency; the second run completed cleanly with a proper summary: `[baseline] done: 736 rounds over 300s`, `[burst] done: ~345 requests fired in 30s`, zero leftover processes.

### Task 32 — Dashboard (`exam-<TOKEN>`) — PromQL per panel

**Panel A — Top 5 slowest endpoints (p95)**
PromQL: `topk(5, histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)))`

**Panel B — Endpoint consuming most TOTAL time**
PromQL: `topk(5, sum(rate(http_request_duration_seconds_sum[5m])) by (route))`
Which endpoint wins Panel A vs Panel B, and why are they different?

> On this system, during the heavy-tenant burst, **`/api/notes` wins both** — p95 pegged at the histogram's 10s ceiling (Panel A), and it also consumed **~65 seconds of server time per second of wall-clock time** (Panel B), only possible because dozens of concurrent `?limit=5000` requests were each running for several seconds simultaneously. They agree here because our own load test concentrated the abuse on one endpoint. In general they diverge for exactly the reason the task describes: Panel A asks "how bad is one call", Panel B asks "how much of the server's total capacity does this endpoint eat" — a rarely-called endpoint that's individually slow can still lose Panel B to a cheap endpoint that's called constantly (e.g. our `/api/search` sits around ~90ms p95 under normal load, but if it were hit 500x more often than `/api/notes`, it — not the slower endpoint — would be where the server's time actually goes). Panel B is the one that should drive prioritization, not Panel A.

**Panel C — Avg + p99 DB query duration by query name**
PromQL avg: `sum(rate(db_query_duration_seconds_sum[5m])) by (query_name) / sum(rate(db_query_duration_seconds_count[5m])) by (query_name)`
PromQL p99: `histogram_quantile(0.99, sum(rate(db_query_duration_seconds_bucket[5m])) by (le, query_name))`

**Panel D — Slowest single query + frequency**
PromQL p99: `histogram_quantile(0.99, sum(rate(db_query_duration_seconds_bucket[5m])) by (le, query_name))`
PromQL frequency: `sum(rate(db_query_duration_seconds_count[5m])) by (query_name)`
Which query is slowest — is it also the most frequent?

> No — different queries win each question. Under the heavy-tenant burst, `select_notes_page` had the highest p99 (**~129ms**), but `select_tags_by_note` was by far the most frequent (**~33,850 calls/sec** at peak, vs 7/sec for the others) at a much lower p99 (~57ms). This is the N+1 bug made numeric: one slow-ish "page" query, then a flood of individually-fast tag lookups whose sheer volume (not their individual speed) is what actually hurts — the same lesson as Panel A vs B, one level down at the query level.

**Panel E — N+1 detector (avg DB queries per request by route)**
PromQL: `sum(rate(db_queries_per_request_sum[5m])) by (route) / sum(rate(db_queries_per_request_count[5m])) by (route)`
Confirmed during dev testing: `/api/notes` averaged **133 queries/request** during the load test (heavy-tenant `limit=5000` requests mean up to 5000 tag lookups for one request), vs `2` for `/api/search`, `/api/stats`, and `~2.2` for `/api/notes/:id`.

**Panel F — Harmful queries over time (threshold)**
PromQL: `sum(rate(db_query_duration_seconds_count[5m])) by (query_name) - sum(rate(db_query_duration_seconds_bucket{le="0.1"}[5m])) by (query_name)`
Threshold chosen and why (base it on your own Panel C data, not a round number):

> **100ms.** Panel C's normal averages (light/ordinary load) sit at 90-330ms depending on query, but the *typical single-row/point queries* (`select_tags_by_note`, `select_note_by_id`) normally execute in single-digit milliseconds when the DB isn't under pool contention — I confirmed this directly with `EXPLAIN ANALYZE` on `select_tags_by_note` (Task 34): **0.076ms** with the index in place, in isolation. So anything crossing 100ms in production for these queries means something is already wrong (queueing, missing index, or N+1 fan-out), not normal variance. During the burst, this panel showed `select_tags_by_note` alone crossing 100ms at **~64.7 queries/sec** — almost the entire harmful-query volume was one query name, which is exactly the N+1 signature.

**Panel G — Rows returned distribution**
PromQL: `histogram_quantile(0.99, sum(rate(db_rows_returned_bucket[5m])) by (le, query_name))`
Confirmed during dev testing: `select_notes_page` p99 rows returned = **~4960** (nearly the exact `?limit=5000` the heavy tenant requested — Problem 4, unbounded limit, made directly visible; every other query stays under 20 rows p99).
What max limit would you set, and what should the API do when a client asks for more?

> I'd cap it at **100**. Our own dashboard shows normal traffic uses `limit=20`; 100 comfortably covers legitimate "show me more" use without letting one request drag back thousands of rows (and, worse under the current N+1 code, thousands of extra queries). If a client asks for more than the max, the API should **not silently clamp it** — clamping hides the mistake from the caller and they'll wonder why pagination looks broken. It should return `400 Bad Request` with a clear message (`"limit must be <= 100"`), so the client fixes their pagination logic instead of quietly getting truncated data.

**Panel H — Error rate + p95 latency by tenant**
PromQL error rate: `sum(rate(http_requests_total{status=~"5.."}[5m])) by (tenant) / sum(rate(http_requests_total[5m])) by (tenant)`
PromQL p95: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, tenant))`
Which tenant looks worse, and is it more data or heavier requests? Prove it.

> **acme** — p95 pegged at the 10s histogram ceiling during the burst, vs ~9.5ms for everyone else. It's **heavier requests, not more data**, and this is provable rather than a guess: acme is the *only* tenant our load script ever sends `?limit=5000` to (a deliberate, controlled variable — every other tenant only ever received `?limit=20` requests, identical to acme's own normal traffic). acme does also happen to have more data (30,000 notes vs ~5,000 for the others from the seed's uneven split), but that alone doesn't explain a 1000x latency gap — the other tenants' normal-sized requests against their smaller datasets stayed just as fast as acme's own normal requests. The moment acme got the oversized-limit requests is the only variable that changed.

**Panel I — In-flight requests vs latency (saturation)**
PromQL in-flight: `http_requests_in_flight`
PromQL p95: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))`
Did latency rise at the same time as concurrency, or was there a delay? What does that tell you about the bottleneck?

> They rose **together** — p95 climbed from 2.4s to the 10s ceiling within ~10s of `http_requests_in_flight` climbing to 161. But they did **not** recover together: in-flight drained back to 1 within about 15s of the burst ending, while p95 stayed pegged at 10s for roughly another 10s past that before dropping to baseline. That lag on the way *down* is the real signal — if the bottleneck were purely "too many HTTP requests at once," latency would drop the instant concurrency does. The delay points to a downstream resource that takes longer to drain than the request queue itself: the Postgres connection pool (default max 10 connections) was still working through a backlog of queued queries — from the N+1 fan-out — after the HTTP layer had already stopped accepting new concurrent work.

**Bugs found and fixed while building this dashboard (both are real production-monitoring lessons, not exam artifacts):**

1. `http_requests_in_flight` got stuck at a high number (129) after the first load test and never came back down, even once the app was idle again. Cause: the metrics middleware decremented the gauge on the Express `res.on('finish')` event, but `finish` never fires if the client disconnects before the response completes — which is exactly what happened when curl processes got killed mid-request during the load test (see Task 31 notes). Fixed by switching to `res.on('close')`, which Node guarantees fires exactly once whether the response completed normally or the connection was aborted early.

2. Under real concurrency (50 simultaneous requests to `/api/notes`), a small number of requests occasionally got mislabeled with `route="/notes"` instead of `/api/notes` — losing the `/api` prefix. Cause: reading `req.route.path` inside the `res.on('close')` handler (i.e. after the whole request had already finished) raced with Express's internal `req.baseUrl`/path restoration for the `app.use('/api', tenantMiddleware)` mount, since `tenantMiddleware` is `async` and awaits a DB query before calling `next()`. Fixed by matching the route pattern ourselves (a small fixed regex list) against the path captured synchronously at the very top of the middleware stack, before any async middleware runs — verified with 50 concurrent requests afterward, all correctly labeled.

_(dashboard JSON exported to `scenario-b/grafana/dashboard.json`)_

### Task 33 — Alert
Provisioned via `scenario-b/grafana/provisioning/alerting/rules.yml` (declarative, not clicked together): fires when p95 latency across all routes exceeds a threshold for a sustained period.

**Threshold: 0.07s** (`histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))`). This value is specific to the exam VPS, and was corrected once against real data: the initial threshold (0.5s) was chosen from local Mac dev-machine testing, where normal p95 was ~0.09s and a heavy burst pushed p95 past 2s. The exam VPS turned out to be dramatically faster under the same load pattern — normal p95 here measured **~0.05s**, and even a heavy combined burst (75 concurrent oversized `?limit=5000`/`?q=` requests firing every 0.1s) only pushed p95 to **~0.08s**. 0.5s was simply unreachable on this hardware. Re-set the threshold to 0.07s (~40% above the real measured baseline) based on the VPS's own numbers, exactly as the task asks — "base it on your normal p95," not a value borrowed from a different machine.

**`for: 15s`.** With `for: 0s`, the alert would fire on the very first breach — a single slow request or one bad scrape would trigger it, which is noisy and not actionable (nobody should get paged for one outlier). `for: 15s` (rule group `interval: 10s`, so multiple consecutive evaluations) requires the breach to be sustained, filtering out one-off spikes and only alerting on a genuinely ongoing problem — at the cost of a real ~15s delay before you find out. Also switched the underlying rate window from `[5m]` to `[1m]`, since a 5-minute window smooths short bursts (30-45s) down too much to reliably cross any threshold at all — seen firsthand when the first few attempts sat in `pending` and kept resetting because the 5-minute-smoothed value flickered back below threshold between evaluations.

Verified by causing it: ran a sustained heavy combined load (multiple tenants, oversized `limit`/`search` requests, 75+ concurrent every 0.1s for 40s). Alert state went `inactive` → `pending` → **`firing`** (confirmed via `GET /api/prometheus/grafana/api/v1/rules`: `alertname: "High p95 latency (any route)"`, state `Alerting`, value `1`).

### Task 34 — Fix one problem
Fixed **Problem 3 — missing FK index on `tags.note_id`**: `CREATE INDEX idx_tags_note_id ON tags(note_id);` (VPS numbers below; dev-machine numbers were similar — ~44x — see earlier local test).

`EXPLAIN ANALYZE` before/after on the exam VPS, full 50k notes / 150k tags dataset (see `evidence/b34-1-explain-before.png`, `b34-2-explain-after.png`):
- `SELECT name FROM tags WHERE note_id = $1` — the query run once per note inside the N+1 loop — went from **Seq Scan, 22.875ms** (150,000 rows scanned) to **Bitmap Index Scan, 0.145ms**: a **~158x speedup** on this VPS's hardware. Since this query runs once per note (up to 5,000 times for the heavy tenant's `?limit=5000` requests), the real-world win is seconds of DB time saved per request, not milliseconds.
- Also captured live on the dashboard: dropped the index, hit `/api/notes/:id` 40 times ("before"), recreated the index ("the fix"), hit it 40 more times ("after") — Panel C (`select_note_by_id` line) shows a clean plateau around p99 ~3.5-4 for the "before" period, then drops sharply to near-0 right at the fix (`b34-3-grafana-before-after.png`).

What did the fix cost?
- Index size: `pg_size_pretty(pg_relation_size('idx_tags_note_id'))` → **2144 kB** for 150,000 rows.
- Write cost: insert timing was noisy on this VPS (12-49ms without the index, 4.6-7.3ms with it, dominated by per-`docker exec` connection overhead rather than the actual index-maintenance cost) — the index *size* is the more honest, reproducible cost figure here; expect a real but small per-insert overhead from B-tree maintenance that this measurement method couldn't isolate cleanly.

Which problem would you fix next, and what would you need to measure first?

> The N+1 query (Problem 1) — it's the biggest live cost by far (Panel E showed `/api/notes` averaging ~133 DB queries per request under load). Before fixing it I'd want Panel B (total time consumed) to confirm `/api/notes`/`select_tags_by_note` really is where the server's aggregate time is going (not just a high per-request count that's individually cheap) — then replace the loop with one `SELECT name, note_id FROM tags WHERE note_id = ANY($1)` and compare `db_queries_per_request` and Panel B before/after.

---

## B4 — Docker Swarm (Tasks 35-40)

### Task 35 — Deploy stack
One node or more?

> Single node (`vmi3536696`) — second VPS had issues, spec explicitly says single node is fine. Swarm on this shared VPS was already active with 3 other students' stacks (`abdur_notes`, `badhon_notes`, `faheem_notes`) running on it — deployed ours as `ashik_notes` without touching theirs. `docker stack services ashik_notes` shows `ashik_notes_app` 3/3 and `ashik_notes_postgres` 1/1.
>
> **Finding:** images built on Mac (Apple Silicon/arm64) failed to schedule on this x86_64 node (`no suitable node (unsupported platform on 1 node)`). Rebuilt with `docker buildx build --platform linux/amd64`. A second issue: buildx's default provenance attestation adds an extra `unknown/unknown` platform manifest to the image index, which this Swarm version (29.7.2) also rejected — fixed with `--provenance=false`. Also found once a service is created against a bad-platform image, `docker service update --force` does not clear the stale `Placement.Platforms` constraint — had to `docker service rm` + `docker stack deploy` again to recreate it clean.
>
> **Finding 2:** the routing mesh (published port 8400) is unreachable via `localhost`/127.0.0.1 on this VPS (curl times out — exit 28) but works correctly via the public IP. All kernel prerequisites (ip_vs, vxlan, br_netfilter, ip_forward=1) are present, and other students' published ports have the identical symptom, so this is a host-level loopback/DNAT quirk in the routing mesh, not an app bug. Workaround: use the public IP for all Swarm testing instead of localhost.

### Task 36 — Scale to 5, prove with hostnames
_(evidence: 5 distinct `X-Served-By` hostnames)_

> Scaled `ashik_notes_app` to 5, all converged Running. 50 requests with `Connection: close` (via public IP, see Task 35 finding) split perfectly evenly: 5 distinct container hostnames, 10 requests each — routing mesh load-balancing confirmed.

### Task 37 — Rolling update, zero downtime
Failure count from `update-log.txt`. If any non-200s, explain honestly why:

> 109,698 requests logged, **all 200 — zero non-200 responses**. `stack.yml`'s `update_config: order: start-first` meant each new v2 task went `Preparing → Starting → Running` (passing the Dockerfile `HEALTHCHECK`) *before* Swarm shut down the old v1 task for that slot — confirmed directly in `docker service ps` output (task.1/task.4 showed the new v2 "Running" with the old v1 still "Running" underneath it, only "Shutdown" a few seconds later). One stray log line reads `ignoring` — that's `nohup: ignoring input` (stderr, not an HTTP response), not a real failure.
>
> Traffic loop was accidentally left running in the background for ~12.5 hours (the first `pkill -f '...%{http_code}...'` failed with a regex error because `{}` is special in extended regex) — killed by PID once caught. Noted here as a shared-VPS hygiene lesson, not part of the graded result.

### Task 38 — Break v3, rollback
How long from deploy command to full rollback (from `docker service ps` timestamps)?

> **~15.5 seconds** — `docker service inspect --format '{{json .UpdateStatus}}'` shows `StartedAt: 15:37:15.716`, `CompletedAt: 15:37:31.209`, `State: rollback_completed`. Fast because v3 (`BREAK_ON_START=true`) does `process.exit(1)` immediately at boot — Swarm's task reaper sees the container exit instantly, it doesn't have to wait through healthcheck retry cycles to decide the task failed.
>
> Honest note: right before this test, `docker stack deploy` was re-run just to add `failure_action: rollback` to the config — but `stack.yml`'s `image:` field was still hardcoded to `v1` (never bumped to `v2` after Task 37), so that redeploy *silently downgraded the running v2 service back to v1* before the v3 test even started. So this rollback actually reverted v3 → v1, not v3 → v2. Still valid evidence of the mechanism (Swarm rolled back to the last known-good spec automatically), just noting the real version numbers rather than claiming it was v2. Lesson: a compose/stack file is the declared source of truth — an out-of-band `service update --image` (like Task 37's v2 deploy) drifts from it until the file itself is updated, and the next `stack deploy` silently reverts that drift.

What would've happened with no healthcheck at all — would Swarm have noticed?

> Partially. This specific break (`process.exit(1)` on boot) would **still** be caught with no `HEALTHCHECK` at all — the container process exiting is a Docker/containerd-level event, not something the `HEALTHCHECK` instruction detects. Swarm sees "exited non-zero" directly and would still mark the task Failed and roll back.
>
> But the *other* common break in the spec — `/healthz` returning 500 while the process itself keeps running — would **not** be noticed without a healthcheck. The container looks "Running" to Swarm either way; only the `HEALTHCHECK` (checked via `docker inspect`'s Health status) tells Swarm the app inside is actually broken. Without it, Swarm would leave that broken task in rotation and the routing mesh would keep sending it real traffic forever.

### Task 39 — Limits vs reservations
What did you observe, and how does limit differ from reservation?

> Set `--reserve-memory 8G` (node has ~7.75GiB total) and scaled 3→4. Result (`docker service ps --no-trunc`): the brand-new replica (slot 4) stuck `Pending — "no suitable node (insufficient resources on 1 node)"` forever, and slot 3's *replacement* task got the same error — but slot 3's **old v1 task kept running** the whole time, because `start-first` never tears down the old task until the new one is ready, and the new one can never become ready. So existing traffic was completely unaffected; only new placement was blocked.
>
> **Reservation** = a scheduling-time promise ("don't place this task unless a node has this much free"). If no node can satisfy it, Swarm just refuses to schedule — it never touches already-running tasks. **Limit** (`--limit-memory`) is a runtime cap enforced by cgroups on a container that's already running — exceed it and the kernel OOM-kills the container (`exit 137`), same mechanism as the OOM drill in B2 Task 28a. Reservation controls *whether* a task starts at all; limit controls what happens to a task *after* it's running.
>
> Reverted after the test: `docker service update --reserve-memory 0 --replicas 3 ashik_notes_app`.

### Task 40 — Scale down during live traffic
Failure count:

> **1527 requests logged during the 5→2 scale-down, all 200 — zero failures.** (One stray `ignoring` line is `nohup: ignoring input` stderr again, not an HTTP response.) Makes sense: scale-down just stops the extra tasks and removes them from the routing mesh's pool — there's no "replacement" involved like a rolling update, so there's nothing that can be *not ready yet*. The routing mesh only had to stop sending new requests to the 3 removed tasks, which it did cleanly.

---

## B5 — CI/CD (Tasks 41-46)

### Task 41 — PR pipeline
Failed run link:
> https://github.com/Ashikur540/devops-exam/actions/runs/34379151895 — deliberately broke the `/healthz` status assertion (expected 201 instead of 200) in `scenario-b/app/test/app.test.js`. Unit test step failed, and the Docker build / container-smoke-test steps were correctly skipped (workflow fails fast).

Passed run link:
> https://github.com/Ashikur540/devops-exam/actions/runs/34379272429 — same PR, fixed the assertion back to 200 and pushed again. All steps green including the real container smoke test (build image, run it against a real `postgres:16-alpine` service container, curl `/healthz`, exit non-zero if it never comes up healthy) — this is the step that would catch an image that builds fine but crashes/hangs on boot, which a build-only check would miss.
>
> 4 real unit tests (`node --test`, Node's built-in runner, no new dependency): `/healthz` returns 200, `/healthz` sets `X-Served-By`, `/api/notes` without `X-Tenant` returns 400, unknown route returns 404. Refactored `server.js` to guard its DB-check-and-listen startup behind `require.main === module` so tests can import the Express app directly without needing a live Postgres.

### Task 42 — Caching
Cold run duration: ___  Warm run duration: ___  Improvement:

> Added `actions/setup-node@v4` with `cache: npm` + `cache-dependency-path` to `.github/workflows/pr.yml`.
>
> Cold run (no cache to restore, `npm cache is not found`): job **40s** total, `npm ci` itself reported `added 86 packages... in 1s`.
> Warm run (`Cache hit for: node-cache-Linux-x64-npm-...`, `Cache restored successfully`): job **32s** total, `npm ci` reported `added 86 packages... in 753ms`.
>
> ~20% faster job overall, ~25% faster on the `npm ci` step itself. Honest note: the improvement is modest in absolute terms because this app only has 86 packages (express/pg/prom-client + a small dependency tree) — the network-fetch time the cache skips just isn't that large here. The mechanism is proven correct (a real `Cache hit`/`Cache restored` log line, not a guess), it just doesn't produce a dramatic number on a small project. First had to learn GitHub Actions caches are scoped per-branch (not shared across unrelated feature branches) — the first "warm" attempt on a different branch than the one that saved the cache still came back cold; the real warm run needed to be on the same branch that had already saved a cache.

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
