# Scenario C — AWS and Multi-Tenancy — Answers

Exam token used in this scenario's screenshots: `ashik-devops-vmi3536696-1788500224-d4790b52`

## C1 — IAM (Tasks 47-48)

### Task 47 — exam-deployer policy

_(policy JSON: `scenario-c/aws/exam-deployer-policy.json`, evidence: `evidence/c47-1-push-success-terminal.png`, `evidence/c47-2-denied-s3.png`)_
Where you used `"*"`, note why here:

> `ecr:GetAuthorizationToken` must use `Resource: "*"`. It's an account-level action (it
> returns a token for the whole ECR registry, not a specific repo), and AWS does not support
> resource-level restriction on it. Every other action in the policy is scoped to one exact
> repository ARN (`repository/ashik-notes-api`) or one exact service ARN
> (`service/ashik-notes-cluster/ashik-notes-svc`).

**Real bug hit:** the first push attempt uploaded every layer successfully but failed on the
final manifest step with `not authorized to perform: ecr:BatchGetImage`. AWS's own docs list
only `BatchCheckLayerAvailability`, `InitiateLayerUpload`, `UploadLayerPart`,
`CompleteLayerUpload`, `PutImage` as the push permissions, but modern Docker CLI also calls
`BatchGetImage` at the end of a push (to check for an existing manifest). Added it as a second
policy version and the push then completed. Documenting it here instead of just silently adding
it, since the AWS docs being incomplete for this is a genuine gotcha worth recording.

### Task 48 — Policy simulator

_(evidence: `evidence/c48-1-policy-simulator.png`)_
4 actions tested (2 allow, 2 deny), results:

> - `ecr:PutImage` on `repository/ashik-notes-api` → **allowed** (exact repo match)
> - `ecs:UpdateService` on `service/ashik-notes-cluster/ashik-notes-svc` → **allowed** (exact service match)
> - `s3:DeleteBucket` → **implicitDeny** (no S3 permissions at all in the policy)
> - `ecs:DeleteService` on the same service ARN → **implicitDeny** (only `UpdateService` is granted, not the whole `ecs:*` namespace)

---

## C2 — ECS deployment (Tasks 49-54)

### Task 49 — Push to ECR

_(evidence: `evidence/c49-1-ecr-tag-size.png`, tag `v1`, 50.48 MB, digest matches the push output)_

### Task 50 — Task definition

_(task-def JSON: `scenario-c/aws/task-definition.json`, account ID redacted as `<ACCOUNT_ID>`;
registered as `ashik-notes-task:1`. Evidence of a running task + CloudWatch logs comes with
Task 51, once the ECS service is actually live.)_

Ran Postgres as a second container in the same task instead of RDS (the exam spec explicitly
allows "just run Postgres in a container"). Because `awsvpc` networking means both containers
share one network namespace, the app reaches it at `localhost:5432` via `DATABASE_URL`. This
needed more than the spec's suggested 256 CPU / 512 MB, since that number assumes a separate DB,
so I bumped it to 512 CPU / 1024 MB. Still Fargate's cheapest realistic tier for two containers.

### Task 51 — Behind ALB

_(evidence: `c51-1-different-tasks.png`, 10 requests to the ALB's `/healthz` alternate between
two `X-Served-By` hostnames, `ip-172-31-27-75...` and `ip-172-31-15-26...`, proving round-robin
across two different Fargate tasks)_

### Task 52 — Autoscaling

_(evidence: `c52-1-scaling-policy.png`, `c52-2-scale-out-count.png`, `c52-3-scale-out-events.png`,
`c52-4-cpu-graph.png`, `c52-5-load-test-summary.png`)_

Time from CPU going high to a new task actually serving traffic — add up metric delay + alarm evaluation + task startup + health checks. Why can't autoscaling save you from a sudden spike?

> Real timestamps from this run (`hey -z 5m -c 50` against `/api/search?q=abc`, an unindexed
> LIKE query over 50k seeded notes):
>
> - Load test started: 03:33:13
> - ECS actually changed desired count 2 → 4 ("Setting desired count to 4"): ~03:38-03:39,
>   about 5-6 minutes later. That's CloudWatch's metric delay plus the target-tracking alarm
>   needing a few consecutive 1-minute datapoints over the 50% threshold before it acts.
> - New tasks confirmed `Running` behind the ALB: by 03:42, another ~3-4 minutes for Fargate to
>   pull and start a 2-container task, then pass the container health check and the ALB target
>   group's health check before it gets real traffic.
> - **Total: ~9 minutes** from the CPU spike starting to a new task actually serving requests.
>
> That's why autoscaling can't save you from a *sudden* spike. A spike shorter than ~9 minutes
> is already over (or has already caused timeouts/errors) before any new capacity exists.
> Autoscaling helps with sustained or gradually-growing load, not a flash traffic burst. For
> that you need pre-provisioned headroom (a higher min-capacity) or backpressure/a queue in
> front of the app, not a reactive scale-out policy.
>
> **Scale-in was much slower than scale-out**, as expected: load test ended ~03:38, but the
> service didn't step back down to the minimum of 2 tasks until ~04:04, **~26 minutes**, and it
> stepped down gradually (4 → 3 → 2) rather than dropping straight to the minimum. This matches
> the exam's own hint that "cooldown periods are long by default." Target tracking is
> deliberately conservative about scaling in, to avoid flapping if load is just briefly dipping.

### Task 53 — Deploy from CI/CD

_(evidence: `c53-1-pipeline-success.png`, `c53-2-new-task-def-revision.png` (revision 1 → 3),
`c53-3-trust-policy-repo-condition.png`. Policies: `scenario-c/aws/github-actions-oidc-trust-policy.json`,
`scenario-c/aws/github-actions-ecs-deploy-policy.json`)_

Added a `deploy-to-ecs` job to `deploy.yml`, authenticating via GitHub's OIDC token instead of a
stored AWS access key. An IAM role (`github-actions-ecs-deploy`) trusts only this repo's `main`
branch. Real bugs hit getting this working:

1. **`Not authorized to perform sts:AssumeRoleWithWebIdentity`** even with the role's `sub`
   condition looking correct. Root cause found via CloudTrail (`aws cloudtrail lookup-events
   --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity`): GitHub's
   actual token `sub` claim was `repo:Ashikur540@71774350/devops-exam@1353838435:ref:refs/heads/main`.
   GitHub appends stable numeric owner/repo IDs to the subject claim (likely because this
   repo/owner was renamed at some point), not the plain `repo:OWNER/REPO:ref:...` format most
   OIDC examples show. Fixed by matching the exact observed value.
2. Also tried `role-skip-session-tagging: true` on a hunch (`configure-aws-credentials@v4` tags
   sessions by default, needing `sts:TagSession`). Turned out not to be the actual cause here,
   but it's a real, separate gotcha worth keeping since it's a one-line no-downside fix.
3. Once auth worked, the role still lacked `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition`
   (both account-level-only actions, no resource restriction possible, same class of `"*"`
   exception as Task 47's `ecr:GetAuthorizationToken`), `ecs:DescribeServices`, and `iam:PassRole`
   on the task execution role. Gave this role its **own** policy instead of reusing
   `exam-deployer-scoped-policy`. A CI/CD deploy role legitimately needs broader ECS read/write
   than the human `exam-deployer` user from Task 47, and widening that user's policy would have
   invalidated the least-privilege proof already captured there.

### Task 54 — Debug a broken deploy

_(evidence: `c54-1-break-command.png`, `c54-2-failure-state.png`, `c54-4-fixed-state.png`)_

Which thing did you break, and exact order of checks used to debug it?

> **Broke it:** changed the target group's health check path from `/healthz` to `/health`
> (a route that doesn't exist, so the app returns 404 for it) via `aws elbv2 modify-target-group`.
>
> **Order of checks used to debug:**
>
> 1. `curl` the ALB directly. Still got occasional 200s during the transition, so the app itself
>    wasn't down. Pointed at something between the ALB and the app, not the app crashing.
> 2. `aws elbv2 describe-target-health`. Showed both real targets `unhealthy` with reason
>    `Target.ResponseCodeMismatch`, and ECS already `draining` and replacing them (visible in the
>    ECS service's Events tab too). `ResponseCodeMismatch` specifically means the health check
>    *is* reaching the container and getting a response, just not the expected `200`. That
>    narrows it to "wrong health check config," not "container isn't listening" or "container
>    crashed" (which would show `Target.FailedHealthChecks` / connection-refused reasons instead).
> 3. `aws elbv2 describe-target-groups` on that target group. Read back `HealthCheckPath` and
>    saw `/health` instead of the app's real `/healthz` route (confirmed against `server.js`).
> 4. **Fix:** `aws elbv2 modify-target-group --health-check-path /healthz` back to the correct
>    path. Within ~30-45s (2 consecutive healthy checks at a 15s interval) both targets flipped
>    back to `healthy` and the ALB was serving 200s again.
>
> That mismatch-reason distinction (`ResponseCodeMismatch` vs a connection-level failure) is the
> single most useful signal for this class of bug. It immediately rules out "the container is
> broken" and points straight at the health check configuration instead.

---

## C3 — S3 (Tasks 55-58)

### Task 55 — Private bucket + presigned upload

_(evidence: `evidence/c55-1-upload-success.png`, presigned URL generated for
`tenants/acme/private/<uuid>-myfile.png`, `curl -X PUT` upload returns HTTP 200. No separate
S3-console screenshot of the object, see `INCOMPLETE.md`.)_

Bucket created with `BlockPublicAcls`/`IgnorePublicAcls` on but `BlockPublicPolicy`/
`RestrictPublicBuckets` deliberately left off. Task 57 needs a scoped bucket *policy* to make
`public/*` readable later, and there was no point blocking that now just to reopen it. The app
uses a dedicated `ashik-notes-app-s3` IAM user (deleted at final cleanup) scoped to only
`s3:GetObject`/`s3:PutObject` on this one bucket to generate the presigned URLs. Tenant
isolation itself is enforced in app code (Task 58), not via IAM per-tenant scoping.

### Task 56 — Presigned download + expiry

_(endpoint built and deployed, `GET /api/attachments/:id/download-url`, 60s presigned GET, but
the curl proof was never run. Not attempted due to running out of session time; see
`INCOMPLETE.md`.)_

If a presigned URL leaks in a public group — what can strangers do, for how long? Two ways to reduce the risk, and which you'd actually implement:

> A stranger with the URL can `GET` (download) that **one specific file**, read-only, until the
> signature expires: at most 60 seconds from when the app generated it, not from when it was
> shared, so realistically often less by the time someone clicks it in a busy group chat. They
> get nothing else: not other files, not write access, not a reusable credential.
>
> Two ways to reduce the risk:
> 1. **Shorten the expiry further** (e.g. 10-15s). Narrows the window, but doesn't eliminate it,
>    and too short breaks the legitimate case where a slow connection or a user who reads the
>    chat a minute late can't open it either.
> 2. **Make it single-use at the app layer.** Track a `used_at` timestamp on the `attachments`
>    row, set the first time the file is actually fetched (e.g. via a CloudFront/app-side
>    redirect that checks-then-presigns rather than handing out the raw S3 URL directly), and
>    refuse to serve it again even within the expiry window.
>
> I'd actually implement **#2**, not IP-binding (a third option, but brittle: mobile networks
> and corporate NATs change source IP mid-session, causing false failures for the real user).
> Single-use directly matches the threat model in this question. It doesn't matter how long the
> URL stays technically valid if the first person to click it (legitimate or not) consumes it.

### Task 57 — Public vs private prefixes

_(not attempted, the bucket's public-access-block settings were already configured with this
task in mind (`BlockPublicPolicy`/`RestrictPublicBuckets` left off), but the actual
`put-bucket-policy` call and the 3 proofs were never done. See `INCOMPLETE.md`.)_

### Task 58 — Tenant isolation on presign

_(the tenant-ownership check itself is implemented and deployed, see
`GET /api/attachments/:id/download-url` in `scenario-b/app/src/server.js`, which looks up the
attachment's real `tenant_id` and returns 403 on any mismatch before ever calling `presignGetUrl`,
but the actual cross-tenant curl proof was never run. See `INCOMPLETE.md`.)_

---

## C4 — Multi-tenancy with subdomains (Tasks 59-62)

_(not started, ran out of session time. See `INCOMPLETE.md` for the concrete plan, including the
already-known Task 62.3 header-spoofing bug and how nginx would fix it.)_

Domain planned: `sslip.io` wildcard subdomains off the VPS's own public IP (e.g.
`acme.169-58-246-108.sslip.io`), chosen so wildcard DNS works instantly with no signup or DNS
record management, per the AskUserQuestion decision earlier in this session.

### Task 59 — Wildcard DNS + Host routing

Not attempted.

### Task 60 — Automatic tenant provisioning

Not attempted.

### Task 61 — Custom domain (BYO domain)

Not attempted.

### Task 62 — What can go wrong

Not attempted, but #3 is already a known, real bug in this codebase (see `INCOMPLETE.md`):
`tenantMiddleware` in `server.js` currently trusts the client-supplied `X-Tenant` header with no
verification at all, so `curl -H "X-Tenant: globex" http://acme.yourdomain.com/api/notes` would
in fact leak globex's data today. Fixing it means moving tenant identification into nginx (Host
header → `$tenant`, set via `proxy_set_header X-Tenant $tenant`, never passed through from the
client) rather than trusting the app-level header at all.

---

## C5 — Cleanup (Task 63)

Deleted everything created for Scenario C: the S3 bucket (and its one test object), the ECR
repo, the ECS cluster and task definition, the CloudWatch log group, both security groups, and
all 3 IAM identities created for this scenario (`exam-deployer` user+policy,
`github-actions-ecs-deploy` role+policy, `ashik-notes-app-s3` user+policy). Deliberately left
untouched: `ecsTaskExecutionRole` (pre-existing in this shared account since before this exam,
another student may depend on it), the default VPC, the GitHub OIDC provider (also pre-existing
and shared), and this account's own `ashik` login.

Verified via `aws ecs list-clusters`, `aws elbv2 describe-load-balancers`, `aws s3 ls`,
`aws ec2 describe-instances` (all empty) plus `aws iam list-users`/`list-roles`: confirmed none
of the 3 identities above remain, while other students' resources in this shared account
(`badhon`, `alamin`, `faruq`, etc.) were left alone. This was run for real, but not
screenshotted, see `INCOMPLETE.md`. Billing/Cost Explorer screenshot also not captured (IAM
user billing-console access needs a separate permission grant from the account owner, never
followed up on, see TIMELINE.md, 2026-09-11).
