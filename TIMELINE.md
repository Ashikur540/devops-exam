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

## 2026-09-14 — Task 47 + 49 evidence

- Resumed after a two-day break. First push attempt failed on the final manifest step:
  `exam-deployer` wasn't authorized for `ecr:BatchGetImage` — AWS's push-permission docs don't
  list it, but modern Docker CLI needs it anyway. Fixed with a second IAM policy version.
- Second attempt failed differently: ECR login token had expired (12h TTL, we'd logged in two
  days earlier) — re-ran `aws ecr get-login-password | docker login` and the push went through
  cleanly.
- Confirmed the AWS account is shared with at least one other person beyond the team lead —
  saw a `badhon/devops-exam` ECR repo sitting next to ours. Left it untouched, same rule as the
  shared VPS.
- Task 47 (exam-deployer push proof + `aws s3 ls` AccessDenied) and Task 49 (ECR image tag +
  size) evidence captured and verified.

## 2026-09-14/15 — C2 free setup (no billing yet)

Deliberately split C2 into a free "setup" day and a billable "main work" day, since ALB and
running Fargate tasks bill per hour with no meaningful free tier. Today only created resources
that cost nothing until something actually runs on them:
- ECS cluster `ashik-notes-cluster` (Fargate clusters are free — cost only starts when a task runs).
- CloudWatch log group `/ecs/ashik-notes`.
- Confirmed `ecsTaskExecutionRole` already existed in this account (created 2026-09-07, last
  used in `us-east-1`) — more proof this AWS account is shared with at least one teammate, and
  that we're naturally isolated from their work by using a different region (`ap-southeast-1`).
- Default VPC + 3 public subnets (one per AZ) identified for the ALB.
- Two security groups: `ashik-notes-alb-sg` (port 80 open to the internet) and
  `ashik-notes-task-sg` (port 3000 open only to the ALB's security group, not the internet).
- Task definition `ashik-notes-task:1` registered — Postgres and the app as two containers in
  one Fargate task (`awsvpc` networking, so they talk over `localhost`), 512 CPU / 1024 MB
  (bumped up from the spec's suggested 256/512, which assumes a separate DB like RDS — ours
  needs headroom for both containers). Documented the tradeoff in ANSWERS.md.
- Real problems hit:
  - Large multi-line heredoc pastes into the VPS SSH session get silently corrupted (dropped
    characters mid-line) — same class of bug as a B2 incident. Fixed by `scp`-ing the task
    definition JSON directly from the local machine instead of pasting it, then `sed` to fill
    in the account ID (kept as `<ACCOUNT_ID>` in the committed file).
  - `aws ecs register-task-definition`'s JSON output got sent through the CLI's default pager
    (`less`), which looked like the terminal had hung. Fixed with `export AWS_PAGER=""`.

## 2026-09-15 (later) — Task 53 (partial) + mid-work pause, cleanup

- Task 53: created a GitHub OIDC trust role (`github-actions-ecs-deploy`, reusing the OIDC
  provider that was already in this shared account) scoped to this repo's `main` branch, reused
  the `exam-deployer-scoped-policy` on it, and added a `deploy-to-ecs` job to `deploy.yml`.
- Hit a real stuck-queue repeat of the B5 Task 46 problem: an old approval-gated run from
  2026-09-11 was still "waiting" 3+ days later and blocking the `deploy-main` concurrency group.
  Cancelled it manually via the GitHub web UI (same fix as before).
- `deploy-to-ecs` failed twice with `Not authorized to perform sts:AssumeRoleWithWebIdentity`.
  First hypothesis: `configure-aws-credentials@v4` tries to tag the session by default, which
  needs `sts:TagSession` on top of `AssumeRoleWithWebIdentity` — added `role-skip-session-tagging:
  true` to skip it. Re-ran: **same error, still unresolved.** Left as an open bug to debug next
  session (candidates not yet checked: IAM propagation delay, an organization-level SCP on this
  shared account restricting STS actions, or a subtler trust-policy condition mismatch).
- Mid-session, the user had to step away for work (office) with the ALB + 2 running Fargate
  tasks from Task 51/52 still live and billing. Per the standing rule for this scenario (don't
  leave billable-per-hour AWS resources unattended), deleted the ECS service, deregistered the
  autoscaling target, and deleted the ALB + target group before pausing — kept the free
  resources (cluster, task definition, security groups, log group, IAM roles/policies) so the
  next session can rebuild the ALB + service quickly without redoing the IAM/networking setup.
- Also tried switching the `gh`/git CLI to a different (office) GitHub account mid-session to
  get direct push access; the device-flow login kept re-authenticating the same old account
  because the browser used to approve it was already logged into that account. Reverted to the
  existing account, which turned out to already have working push access (unclear exactly when
  that changed) — pushed directly from here for the rest of this segment instead of routing
  every commit through GitHub Desktop.
- Next session: debug the OIDC `AssumeRoleWithWebIdentity` failure, finish Task 53, Task 54
  (break/debug), then C2 final cleanup.

## 2026-09-15 (later still) — Task 53 fixed, Task 54, C2 complete

- Recreated the ALB + ECS service (cluster/task-def/security-groups were kept free from
  yesterday), then debugged the OIDC failure properly:
  - Root cause found via `aws cloudtrail lookup-events` on `AssumeRoleWithWebIdentity`: GitHub's
    real token `sub` claim was `repo:Ashikur540@71774350/devops-exam@1353838435:ref:refs/heads/main`
    — GitHub appends immutable numeric owner/repo IDs to the subject (this repo or its owner was
    renamed at some point), not the plain `repo:OWNER/REPO:...` format. Updated the trust policy
    to the exact value and auth started working.
  - Two more permission gaps surfaced one at a time as later steps ran: `ecs:DescribeTaskDefinition`
    + `ecs:RegisterTaskDefinition` (account-level only, no resource restriction possible),
    then `ecs:DescribeServices`, then needed `iam:PassRole` on the execution role. Gave the CI
    role its own dedicated policy rather than widening `exam-deployer-scoped-policy` (would have
    invalidated the Task 47/48 least-privilege evidence).
  - Pipeline went green end to end: task definition revision 1 → 3, service stable, 2 healthy
    tasks.
- Task 54: broke the target group's health check path (`/healthz` → `/health`, a 404 route),
  watched real failure (`Target.ResponseCodeMismatch`, ECS draining/replacing tasks in a loop),
  debugged by reading the failure *reason* (rules out a crashed container vs. a config problem),
  fixed by reverting the path, confirmed both targets healthy again within ~40s.
- **C2 complete — 36/36 marks.** Deleted the ALB, target group, and ECS service immediately
  after (kept the free resources — cluster, task definition, security groups, log group, IAM
  roles/policies — since nothing else in C3/C4 needs them; final full teardown happens at C5
  Task 63).
- Also this session: briefly tried switching the authenticated GitHub CLI account to a personal
  "office" account mid-session for direct push access — the device-flow login kept
  re-authenticating whichever account the browser used to approve it was already logged into,
  so it didn't actually switch. Reverted to the original account, which turned out to already
  have working push/admin access (unclear exactly when that changed) — pushed directly and
  cancelled a stuck workflow run from this session onward instead of routing through GitHub
  Desktop.
- Next: C3 — S3 and file uploads (20 marks).

## 2026-09-15/16 — C3 started, Task 55 working, big deploy debugging saga

Started C3 (S3 attachments). Created a private S3 bucket with public ACLs blocked but the
bucket-policy block left open on purpose (Task 57 will need a scoped public/ prefix later — no
point blocking that now just to reopen it in a day or two). Made a dedicated `ashik-notes-app-s3`
IAM user for the app to generate presigned URLs with, scoped to just that bucket. Added two new
endpoints to the app (`POST /api/attachments/upload-url`, `GET /api/attachments/:id/download-url`)
plus an `attachments` table so a download request can be checked against the requester's tenant
*before* anything gets signed — that check is the whole point of Task 58.

A few real mistakes and a genuinely annoying debugging session along the way, worth recording
honestly:

- Pasted a real AWS secret access key into the chat by accident (twice, actually) while setting
  up the app's IAM credentials. Rotated the key both times. Lesson that stuck: write credentials
  straight to a file on the VPS from a script, never type/paste them through the chat at all.
- Large multi-command pastes into the VPS SSH session keep corrupting mid-paste (this is now the
  third time this exact thing has happened across the whole exam). The fix that's actually
  reliable: one file per paste, nothing chained after it in the same block, and verify immediately
  after (line count, `node -c`, `python3 -m json.tool`) rather than assuming success.
- Discovered the Postgres container backing the whole `ashik_notes` Swarm stack had **zero
  tables** despite running fine for 7 straight days — the app never noticed because `/healthz`
  doesn't touch the DB and the startup check is just `SELECT 1`, which needs no tables at all.
  Reloaded schema + seed data properly this time.
- Then lost well over an hour to what looked like a deployment that silently refused to update.
  `docker build` kept reporting fresh, non-cached layers, but the running containers kept coming
  back with the *old* code no matter how many times the image got rebuilt and force-pushed to the
  Swarm service. Root cause: `docker service update --force --image <tag>` and
  `docker inspect --format '{{index .RepoDigests 0}}'` were both silently resolving to a stale
  digest left over from an earlier failed push (Docker Hub auth had quietly expired), not the
  image that was actually just built. The image's own `Created` timestamp was also misleading —
  it showed a build from over a week earlier, most likely BuildKit's provenance/attestation
  feature normalizing timestamps for reproducible builds (the same class of "attestation manifest"
  issue that broke Swarm scheduling back in B4). What actually worked: `docker login` again,
  build with `--no-cache`, run the fresh image directly with `docker run --rm <tag> grep ...`
  to confirm the code *before* touching the registry at all, then push and read the digest
  straight out of that specific `docker push` command's own output — never trust `docker inspect`
  or a tag name alone to say what's actually running.
- Confirmed Task 55 works end to end after all that: presigned PUT URL generated, upload
  succeeded (HTTP 200), object visible in the S3 console.

Stopped here for the night — verified no ECS services, tasks, or load balancers are running
(only free resources like the S3 bucket with one tiny test object, and IAM users/policies, are
left), so nothing is billing per hour overnight. Task 56-58 tomorrow morning, then C4.
- Nothing billable exists yet — safe to leave overnight. Tomorrow: ALB + ECS service (Task 51),
  autoscaling + load test (Task 52), CI/CD extension (Task 53), break/debug (Task 54) — done in
  one sitting, then the ALB/service torn down the same day.

## 2026-09-15 — Task 51 + 52 (ALB, autoscaling, real load test)

- Created the ALB, target group (target-type `ip`, required for Fargate `awsvpc` mode), listener,
  and the `ashik-notes-svc` ECS service (2 tasks). Reached steady state in under 2 minutes.
- Each Fargate task runs its own isolated Postgres sidecar (no shared storage), so schema + the
  existing 50k-note seed (`db/seed.sql` from Scenario B) had to be loaded into *each* running
  task's Postgres separately — temporarily opened port 5432 on the task security group from the
  VPS's IP only, seeded both, then closed the rule again.
- Task 51: proved the ALB round-robins across different tasks — 10 requests to `/healthz`
  alternated between two different `X-Served-By` hostnames.
- Task 52: registered a target-tracking autoscaling policy (`ECSServiceAverageCPUUtilization`,
  target 50%, min 2 / max 6), then hammered `/api/search?q=abc` (the deliberately unindexed
  search, now backed by real seeded data) with `hey -z 5m -c 50`. CPU spiked to ~56%, ECS scaled
  2 → 4 tasks. Real timings captured: ~9 minutes from load starting to a new task actually
  serving traffic; ~26 minutes (stepping down gradually, 4 → 3 → 2) to scale back in after the
  load stopped. Documented both numbers and the "autoscaling can't save you from a sudden spike"
  reasoning in ANSWERS.md.
- Real problems hit:
  - `watch` in a second SSH session failed with `--region: expected one argument` — `$AWS_REGION`
    isn't exported into a brand-new shell session; fixed by hardcoding the region in that command
    instead of relying on the variable.
  - Forgot the ECS CLI's default pager (`less`) makes JSON output look like a hang — same fix as
    yesterday, `export AWS_PAGER=""` up front in every new session from now on.
