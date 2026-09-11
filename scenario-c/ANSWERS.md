# Scenario C — AWS and Multi-Tenancy — Answers

Exam token used in this scenario's screenshots: `PASTE_TOKEN`

## C1 — IAM (Tasks 47-48)

### Task 47 — exam-deployer policy
_(policy JSON: `scenario-c/aws/exam-deployer-policy.json`, evidence: successful ECR push, denied `aws s3 ls`)_
Where you used `"*"`, note why here:

> `ecr:GetAuthorizationToken` must use `Resource: "*"` — it is an account-level action (it
> returns a token for the whole ECR registry, not a specific repo), and AWS does not support
> resource-level restriction on it. Every other action in the policy is scoped to one exact
> repository ARN (`repository/ashik-notes-api`) or one exact service ARN
> (`service/ashik-notes-cluster/ashik-notes-svc`).

### Task 48 — Policy simulator
4 actions tested (2 allow, 2 deny) — results:

> 

---

## C2 — ECS deployment (Tasks 49-54)

### Task 49 — Push to ECR
_(evidence only)_

### Task 50 — Task definition
_(task-def JSON committed with account ID redacted, evidence: running task, CloudWatch logs)_

### Task 51 — Behind ALB
_(evidence: repeated requests showing different task identities)_

### Task 52 — Autoscaling
Time from CPU going high to a new task actually serving traffic — add up metric delay + alarm evaluation + task startup + health checks. Why can't autoscaling save you from a sudden spike?

> 

### Task 53 — Deploy from CI/CD
_(evidence: pipeline run deploying to ECS, new task-def revision, trust policy showing repo condition)_

### Task 54 — Debug a broken deploy
Which thing did you break, and exact order of checks used to debug it?

> 

---

## C3 — S3 (Tasks 55-58)

### Task 55 — Private bucket + presigned upload
_(evidence: presigned URL, successful upload, object in console)_

### Task 56 — Presigned download + expiry
_(evidence: works within 60s, S3 XML error after expiry, AccessDenied without presigning)_
If a presigned URL leaks in a public group — what can strangers do, for how long? Two ways to reduce the risk, and which you'd actually implement:

> 

### Task 57 — Public vs private prefixes
_(evidence: public/ works plain, private/ AccessDenied plain, private/ works presigned)_

### Task 58 — Tenant isolation on presign
_(evidence: acme requesting globex's key → 403)_

---

## C4 — Multi-tenancy with subdomains (Tasks 59-62)

Domain used: `PASTE_DOMAIN` (real domain / DuckDNS / nip.io / `/etc/hosts` simulation — state which)

### Task 59 — Wildcard DNS + Host routing
_(evidence: acme vs globex different notes, unknown subdomain clean 404, one app instance serving all)_

### Task 60 — Automatic tenant provisioning
_(evidence: one terminal session — create tenant, curl new subdomain immediately works)_
Why no DNS/nginx change needed?

> 

Slug validation — reserved names blocklist (www/api/admin/etc), dots rejected — evidence of one rejection:

> 

### Task 61 — Custom domain (BYO domain)
Which did you do — real second domain, or other? State clearly:

> 

### Task 62 — What can go wrong
1. Customer points DNS before verifying — what does a visitor see right now, is that OK, how did you fix it (proper "not configured" page)?

> 

2. Two tenants claim the same custom domain — what stops the second one (DB constraint / app check)? Show the error.

> 

3. Faked `X-Tenant` header — does `curl -H "X-Tenant: globex" http://acme.yourdomain.com/...` leak globex's data? Fix (nginx must overwrite, never pass through client header) and show fixed.

> 

4. One more isolation bug found in your own code — what and where:

> 

---

## C5 — Cleanup (Task 63)

_(evidence: resource listing commands showing nothing left, Billing/Cost Explorer screenshot)_
