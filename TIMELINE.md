# Work Timeline

## 2026-09-01

- Read full exam spec, scaffolded repo structure.
- Completed Scenario A1 (users, groups, permissions, ACL for dan, sticky-bit fix for carol, restricted sudo for alice/bob) — time spent: ~2.8 hrs.
- Next: Scenario A2 (port investigation, A2).

## 2026-09-02

- Understood the A2.
- Learned about how to trace the port availability and answered the questions
- time spent: ~1.5 hrs.
- Next: Scenario A3 (A3 — A bash script you would actually use).

## 2026-09-03

- Finished Scenario A2 answers and proof (port investigation), committed.
- time spent: ~1 hr.
- Next: Scenario A3.

## 2026-09-04

- Completed Scenario A3 (healthcheck.sh + cron), A4 (systemd unit, restart limits, journalctl queries, watchdog timer for the "alive but hung" case), and A5 (nginx reverse proxy, load balancing, failover, slow-endpoint/504 handling, rate limiting) — finished all of Scenario A (82 marks) by end of day.
- time spent: ~6-7 hrs across A3-A5.
- Next: plan and start Scenario B.

## 2026-09-05

- Built Scenario B's app from scratch: multi-tenant Notes API (Express + pg), schema, seeder script (5 tenants, 50k notes uneven spread, 150k tags), keeping the 4 deliberate bugs in (N+1 query, unindexed search, missing FK index, unbounded limit).
- Completed B1 (multi-stage Dockerfile, 87% size cut, layer caching, secrets-in-layers trap), B2 (compose file with real Postgres-readiness fix, volume persistence, all 4 debugging drills), and B3 (Prometheus metrics via prom-client, Grafana dashboard with 9 panels, load test script, alerting rule, fixed the missing-index problem) — all tested locally on Mac Docker first, then moved to the real exam VPS for actual evidence.
- Problems hit on the VPS today, and how they got fixed:
  - Docker needed `sudo` for every command since the user wasn't in the `docker` group — fixed once with `usermod -aG docker`.
  - Our docker-compose project auto-named itself "docker" (from the folder name) and collided with another student's compose project in `docker ps` output — fixed by adding an explicit `name:` to both compose files, so a `--remove-orphans` could never touch someone else's containers.
  - The non-root/healthcheck test container crashed immediately on the VPS because the app now fails fast if Postgres isn't reachable at boot (a fix we added ourselves in B2) — fixed by spinning up a temporary linked Postgres just for that test.
  - A multi-line copy-pasted command block (volume backup/restore test) got garbled in the VPS terminal — stuck at a `>` continuation prompt with some commands receiving wrong arguments. Recovered by running the remaining steps one at a time; turned out the restore had actually already succeeded once inside the garbled block, so the "already exists" errors on the second attempt were harmless — confirmed data was correctly restored via a direct API check.
- time spent so far: ~6 hrs (ongoing).
- Next: finish B2 Task 28 debugging drills and remaining B3 evidence on the VPS, then B4 (Docker Swarm) and B5 (CI/CD).
