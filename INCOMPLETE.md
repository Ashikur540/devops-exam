# Incomplete Work

## Scenario C3 — S3 and file uploads (Tasks 56-58, 15 of 20 marks affected)

**Task 55 (5 marks) — done.** Presigned upload works end to end, evidence in
`scenario-c/evidence/c55-1-upload-success.png`.

**Task 56 (4 marks) — endpoint built, not tested.** `GET /api/attachments/:id/download-url`
is implemented in `scenario-b/app/src/server.js` (60s presigned GET, via `s3.presignGetUrl`)
and deployed to the running app — but I never actually ran the curl test to prove it: the
immediate 200, the wait-61-seconds-then-expired-XML-error check, or the no-presign-URL
AccessDenied check. Ran out of session time. With more time: run the same curl sequence
already used for Task 55, plus `sleep 61` and a retry, plus a plain
`curl https://<bucket>.s3.amazonaws.com/<key>` with no query string.

**Task 57 (6 marks) — not started.** The bucket's public-access-block settings were
deliberately left open for `BlockPublicPolicy`/`RestrictPublicBuckets` in anticipation of this
task (see `scenario-c/ANSWERS.md` Task 50 area / TIMELINE.md), but the actual bucket policy
granting public read on `public/*` was never written, and no object was ever uploaded to
`public/*` to test against. With more time: one `aws s3api put-bucket-policy` call with a
`Principal: "*"` statement scoped to `public/*`, then the 3 required proofs (plain URL to
public/ works, plain URL to tenants/acme/private/ denies, presigned URL to that same private
file works).

**Task 58 (5 marks) — code written, not proven.** The tenant-ownership check in
`GET /api/attachments/:id/download-url` (look up the attachment's real `tenant_id`, compare
against the requester's, return 403 on mismatch) is in the code and is exactly what this task
asks for — but I never actually ran the cross-tenant curl test to produce the screenshot. With
more time: create an attachment as `acme`, then request its download-url as `globex`
(`-H "X-Tenant: globex"`) and confirm the 403.

## Scenario C4 — Multi-tenancy with subdomains (Tasks 59-62, 26 marks — not started)

Ran out of session time before reaching this section. The app already has everything C4 needs
architecturally except the Host-based routing itself: real tenant isolation via `X-Tenant`
(Scenario B), a `tenants` table, and — critically — C4 Task 62.3 is already a known, named bug
in this codebase: `tenantMiddleware` in `server.js` currently trusts the client-supplied
`X-Tenant` header directly with no verification. Nothing stops
`curl -H "X-Tenant: globex" http://acme.yourdomain.com/api/notes` from reading globex's data
today. With more time:

- Task 59: wildcard DNS via `sslip.io` (no signup needed, already decided on this session — see
  TIMELINE.md), nginx `server_name ~^(?<tenant>.+)\.<ip>\.sslip\.io$` block that sets
  `proxy_set_header X-Tenant $tenant` itself — which also happens to fix Task 62.3's bug for
  free, since nginx would then always overwrite the header instead of ever trusting a
  client-supplied one.
- Task 60: `POST /api/tenants` endpoint (insert row + reserved-slug blocklist for `www`/`api`/
  `admin`/etc.).
- Task 61: a second real domain, or state clearly if simulated.
- Task 62: the other 3 sub-answers (unconfigured-domain page, duplicate custom-domain
  constraint, one more real isolation bug found by inspection).

## Scenario C5 — Cleanup (Task 63)

**Resource listing — actually run, not screenshotted.** `ecs list-clusters`,
`elbv2 describe-load-balancers`, `s3 ls`, and `ec2 describe-instances` were all genuinely run
against the real account and came back empty; IAM was also checked and confirmed none of
`exam-deployer`, `ashik-notes-app-s3`, or `github-actions-ecs-deploy` remain (other students'
resources in this shared account — `badhon`, `alamin`, etc. — were left untouched, as they
should be). No screenshot was taken of this output, so there's no `evidence/` file backing it —
the CLI output is only in the work session itself. With more time: re-run the same 4 commands
and screenshot them, since the actual cleanup is already done and this is just missing paperwork.

**Billing/Cost Explorer screenshot — not captured.** Ran out of session time. IAM user access
to the Billing console needed a separate permission grant that was never followed up on this
session (noted in TIMELINE.md, 2026-09-11). With more time: grant `AWSBillingReadOnlyAccess` to
the `ashik` user (or ask the account owner to check Cost Explorer directly) and screenshot the
month-to-date cost, which should show only the earlier stray $8.22 charge unrelated to this
work (see TIMELINE.md) plus negligible S3/ECR storage for the few hours those existed.
