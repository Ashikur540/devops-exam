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

## 2026-09-08 / 2026-09-09

- Finished B3 (Tasks 29-34) evidence and alert threshold fix, wrapping up all of B1-B3 (68 marks).
- Built B4 — Docker Swarm (Tasks 35-40, 26 marks): app updated with `X-Served-By` header, version field, and a `BREAK_ON_START` flag for the v3 rollback test. Deployed a single-node stack (`ashik_notes`) on the shared VPS, which turned out to already be running Swarm with 3 other students' stacks on it.
- Real problems hit and fixed:
  - Images built on Mac (arm64) wouldn't schedule on the VPS's x86_64 node — fixed with `docker buildx --platform linux/amd64`. A second layer of the same bug: buildx's default provenance attestation manifest also broke scheduling on this Docker version — fixed with `--provenance=false`.
  - `docker service update --force` didn't clear a stale platform constraint from the first bad deploy — had to remove and recreate the service.
  - Swarm's routing mesh isn't reachable via `localhost` on this VPS (works fine via the public IP) — confirmed it affects every other student's services too, so it's a host quirk, not our bug. Used the public IP for every test after that.
  - Caught our own config-drift bug: redeploying `stack.yml` just to add `failure_action: rollback` silently downgraded the running v2 service back to v1, because the file's `image:` field was never bumped after the Task 37 test. Rollback test ended up being v3→v1, documented honestly instead of hidden.
  - A background traffic-loop process was left running unattended for ~12.5 hours after a `pkill` regex bug (`{}` is special in extended regex) failed silently — caught it, killed it properly by PID.
- All 6 tasks (deploy, scale-to-5 with hostname proof, zero-downtime rolling update, break+auto-rollback, reservation-vs-limit, scale-down-under-traffic) passed with real evidence, screenshots verified, and committed.
- time spent: ~4-5 hrs.
- Next: B5 — CI/CD with GitHub Actions (30 marks).

## 2026-09-11

- Fixed a real blocker first: the GitHub remote (`Ashikur540/devops-exam`) had gone unreachable (404) from the authenticated CLI account — sorted out by switching auth back to the right account and re-pushing everything via GitHub Desktop for the rest of the session (the CLI account never got write access).
- Built B5 — CI/CD with GitHub Actions (Tasks 41-46, 30 marks), completing all of Scenario B (124/124 marks):
  - Task 41: `.github/workflows/pr.yml` — 4 real unit tests (Node's built-in `node:test`, no new dependency), Docker build, then an actual container-start-and-curl-`/healthz` smoke test against a real Postgres service container. Refactored `server.js` to guard its DB-check-and-listen startup behind `require.main === module` so tests can import the app without a live DB. Demonstrated a real failing PR run, then a real passing one after the fix.
  - Task 42: npm caching via `actions/setup-node`'s `cache: npm`. Learned GitHub Actions caches are scoped per-branch, not shared across unrelated feature branches — first "warm" attempt on a different branch still came back cold; had to push a second commit on the *same* branch to get a genuine cache hit (`added 86 packages... in 1s` cold vs `753ms` warm — modest but real given the tiny dependency tree).
  - Task 43: `.github/workflows/deploy.yml` on push to main, tags with git SHA + version, pushes to **GHCR** using the workflow's own short-lived `GITHUB_TOKEN` instead of a Docker Hub PAT — satisfies the "no long-lived credentials" hard rule with zero secrets needed for registry auth.
  - Task 44: added a `deploy` job gated behind a GitHub `production` Environment with a required reviewer, SSHing into the VPS with a dedicated deploy-only key. Hit two real bugs: the path filter didn't include the workflow file itself (editing `deploy.yml` never triggered `deploy.yml`), and the first `VPS_SSH_KEY` secret paste was missing the `BEGIN/END` lines (`ssh: no key found`) — both fixed.
  - Task 45: broke the pipeline three ways (failing test, bad Dockerfile `COPY`, typo'd Swarm service name in the deploy step) and proved production was untouched every time — the typo'd deploy failed cleanly against a service that doesn't exist, never touching the real `ashik_notes_app`.
  - Task 46: documented the `concurrency: group: deploy-main` safeguard already in `deploy.yml`, with a real incident from this exact session as the example (a follow-up push landing before the first deploy finished).
- time spent: ~4 hrs.
- Scenario B complete. Next: Scenario C — AWS and Multi-Tenancy (94 marks).

## 2026-09-11 (later) — Scenario C kickoff

- Started Scenario C. AWS account belongs to the team lead (shared, has free credits for new users) — confirmed with the account owner before using it; our IAM user (`ashik`) has `AdministratorAccess`.
- Real incident, unrelated to our work: a "My Zero-Spend Budget" alert fired showing $8.22 actual cost for the month, before we had created a single AWS resource. Investigated — billing pages were "Access denied" even for an admin IAM user, because AWS blocks IAM users from viewing Billing/Cost Management unless the **root** account enables "IAM user and role access to billing information" (a root-only, account-level toggle that `AdministratorAccess` does not override). Left as a known gap for now since the team lead's account already has free credit covering it; will revisit at cleanup (Task 63) to confirm final cost.
- Completed Task 47 setup (exam-deployer IAM user): created ECR repo `ashik-notes-api`, wrote a scoped policy (`scenario-c/aws/exam-deployer-policy.json`) allowing only `ecr:GetAuthorizationToken` (account-level, must be `Resource: "*"`, documented why), scoped ECR push actions on the one repo ARN, and `ecs:UpdateService` on one future service ARN (`ashik-notes-cluster/ashik-notes-svc`, named in advance since ECS ARNs are deterministic before the service exists). Created the `exam-deployer` IAM user, attached the policy, generated its access key — verified via `describe-repositories` / `get-user` / `list-attached-user-policies`, all ARNs match.
- Stopped here for the day deliberately — nothing billable-per-hour exists yet (ECR/IAM only), so it's safe to leave overnight. Next session: push evidence for Task 47+49 with the `exam-deployer` profile, Task 48 (policy simulator), then C2 (ECS/ALB/Fargate) — which *does* bill per hour, so that block will be done start-to-finish in one sitting with no overnight gap.
