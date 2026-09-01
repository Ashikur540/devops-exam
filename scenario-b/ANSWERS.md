# Scenario B — Containerize, Ship and Observe — Answers

Exam token used in this scenario's screenshots: `PASTE_TOKEN`

## B1 — Docker image (Tasks 21-25)

### Task 21 — Multi-stage Dockerfile
_(evidence: non-root `whoami`/`id`, healthcheck showing `(healthy)`)_

### Task 22 — Size comparison
What did you remove going from `Dockerfile.naive` to multi-stage, and what did you give up by removing it?

> 

Naive size: ___  Multi-stage size: ___  (must be ≥60% smaller)

### Task 23 — Layer caching
Which layers were rebuilt after changing one source line, and why?

> 

### Task 24 — Biggest layer
Which layer is biggest, what command created it, could it be smaller?

> 

### Task 25 — Secrets in image layers
Why doesn't `rm` in a later layer remove the file from earlier layers?

> 

---

## B2 — Compose, storage, debugging (Tasks 26-28)

### Task 26 — depends_on vs actually ready
_(evidence: crash with only `depends_on`, then clean start with proper readiness wait)_

### Task 27 — Volumes and persistence
What did `docker compose down -v` do to the data?

> 

_(evidence: notes survive `down`/`up`, notes gone after `down -v`, backup/restore bringing them back)_

### Task 28 — Debugging drill (2 marks each)

**a. Exit code 137**
- What you changed to cause it:
- Symptom:
- Command that revealed the cause:
- Fix:

**b. Can't reach DB by service name, can by IP**
- What you changed to cause it:
- Symptom:
- Command that revealed the cause:
- Fix:

**c. Volume mounted but app sees empty directory**
- What you changed to cause it:
- Symptom:
- Command that revealed the cause:
- Fix:
- How do named volumes behave differently on first creation?

> 

**d. Port published but connection refused from host**
- What you changed to cause it:
- Symptom:
- Command that revealed the cause:
- Fix:

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
