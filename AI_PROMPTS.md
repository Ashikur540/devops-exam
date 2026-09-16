# AI Prompts Log

Bonus: 10 marks. Minimum 8 entries for full marks. Log every time AI genuinely
helped — what you were stuck on, the exact prompt, whether it worked, what you
had to change to make it work on *your* machine. Pasting a prompt with no
"what went wrong" note only earns 2 marks — the gap between the generic
answer and your real problem is what's graded.

I did this whole exam working with Claude Code (an AI coding agent) directly in my terminal,
rather than copy-pasting between a chatbot and my own shell. So instead of a literal typed
prompt, most entries below are "what I told it I was stuck on" and its investigation — same
gap-between-generic-answer-and-real-problem shape the template asks for, just conversational
instead of copy-pasted.

---

## Cross-platform image built on Mac wouldn't schedule on the VPS (Scenario B4)

**Stuck on:** `docker stack deploy` on the VPS reported `no suitable node (unsupported platform
on 1 node)` for an image built and pushed from my Mac.

**Prompt:** Told it the deploy was failing with that exact error and asked it to figure out why.

**Answer:** First response: build with `docker buildx build --platform linux/amd64` since a Mac
(arm64) image won't run on the VPS's x86_64 node.

**What actually fixed it:** That fixed the platform mismatch, but a *second* failure appeared
right after — buildx's default provenance/SBOM attestation adds an extra `unknown/unknown`
platform manifest to the image index, which this Docker version's Swarm scheduler couldn't
parse either. Needed `--provenance=false` on top of the platform flag. The AI's first answer was
correct but incomplete — it took a second real failure to find the second cause.

---

## Swarm wouldn't clear a stale scheduling constraint (Scenario B4)

**Stuck on:** After fixing the platform issue above, `docker service update --force
--image ...` on the same service kept failing to schedule, even though the image itself was now
correct.

**Prompt:** Asked why a force update wasn't picking up the fix.

**Answer:** Explained that `--force` restarts tasks but doesn't clear a `Placement.Platforms`
constraint baked into the service definition from the very first (bad) deploy.

**What actually fixed it:** `docker service rm` + `docker stack deploy` to recreate the service
cleanly, rather than trying to update it in place.

---

## GitHub Actions cache came back cold on a "should be warm" run (Scenario B5 Task 42)

**Stuck on:** Ran the pipeline a second time expecting a warm `npm` cache and got
`Cache not found for input keys` again.

**Prompt:** Pasted the cache miss log and asked why, given the previous run had already saved a
cache.

**Answer:** GitHub Actions caches are scoped per-branch by default — a cache saved on one
feature branch isn't visible from an unrelated feature branch, even in the same repo.

**What actually fixed it:** Pushed two commits on the *same* branch instead of two different
branches, which produced a genuine cold-then-warm pair (`added 86 packages... in 1s` vs
`753ms`).

---

## deploy.yml edits never triggered a run (Scenario B5 Task 44)

**Stuck on:** Committed changes to `.github/workflows/deploy.yml` itself and no workflow run
appeared at all.

**Prompt:** Described that the workflow has a `paths:` filter and asked why editing the
workflow file didn't trigger it.

**Answer:** Correctly spotted immediately — the `paths:` filter listed `scenario-b/**` but not
the workflow file's own path, so GitHub Actions' own path-filter logic excluded the very commit
that edited it.

**What actually fixed it:** Added `.github/workflows/deploy.yml` to its own `paths:` list.

---

## SSH deploy step failing with "no key found" (Scenario B5 Task 44)

**Stuck on:** `appleboy/ssh-action` failed with `ssh.ParsePrivateKey: ssh: no key found` even
though a `VPS_SSH_KEY` secret was definitely set.

**Prompt:** Pasted the exact error from the failed Action run.

**Answer:** Explained this specific error almost always means the secret's content is missing
the `-----BEGIN...-----`/`-----END...-----` lines or has been partially truncated during copy.

**What actually fixed it:** Had to re-copy the *entire* key file with `cat` and re-paste the
complete block into the GitHub secret — the first paste had silently dropped the header line.

---

## `ecr:BatchGetImage` permission missing despite following AWS's own docs (Scenario C1/C2)

**Stuck on:** A scoped IAM policy granting exactly the ECR actions AWS's documentation lists for
pushing an image still got `docker push` to fail on the very last step with
`not authorized to perform: ecr:BatchGetImage`.

**Prompt:** Pasted the exact push failure and the policy already in place.

**Answer:** Identified that modern Docker CLI checks for an existing manifest via
`BatchGetImage` at the end of a push, even though AWS's own IAM reference for "push" permissions
doesn't list it — a real gap between the docs and actual client behavior.

**What actually fixed it:** Added `ecr:BatchGetImage` to the policy as a second version.

---

## GitHub Actions OIDC role kept getting "Not authorized to perform sts:AssumeRoleWithWebIdentity" (Scenario C2 Task 53)

**Stuck on:** A GitHub Actions OIDC trust policy that looked textbook-correct
(`repo:OWNER/REPO:ref:refs/heads/main`) kept being denied by AWS with no more specific error in
the Action log itself.

**Prompt:** Asked it to actually find the real cause rather than guess again, since a first
guess (missing `sts:TagSession` for `configure-aws-credentials@v4`'s default session tagging)
turned out not to be it.

**Answer:** Suggested querying CloudTrail directly for the denied `AssumeRoleWithWebIdentity`
calls to see the *exact* subject claim AWS actually received, instead of trusting what the trust
policy assumed the claim would look like.

**What actually fixed it:** CloudTrail showed the real `sub` was
`repo:OWNER@<numeric-id>/REPO@<numeric-id>:ref:refs/heads/main` — GitHub appends stable numeric
owner/repo IDs to the subject once a repo or its owner has ever been renamed, which isn't the
plain format most OIDC tutorials show. Matching the trust policy to the exact observed value
fixed it immediately.

---

## Deployed containers kept running old code no matter how many times the image was rebuilt (Scenario C3)

**Stuck on:** `docker build` reported fresh, non-cached layers every time, and `docker service
update --force` reported success every time, but `grep`-ing the running containers' files kept
showing the old code, repeatedly, across several rebuild attempts.

**Prompt:** Described the symptom (build looks fresh, deploy looks successful, code is still
old) and asked to actually verify rather than assume the next fix would work.

**Answer:** Suggested stopping the rebuild-and-hope cycle and instead testing the *local* image
directly with `docker run --rm <image> grep ...` before touching the registry or Swarm at all,
to isolate whether the build or the deploy step was the actual problem.

**What actually fixed it:** That test proved the local build itself was fine — the real problem
was `docker service update --force --image <tag>` and `docker inspect .RepoDigests` both
silently resolving to a *stale* digest left over from an earlier push that had failed due to
expired Docker Hub auth (which failed with an error easy to miss inside a longer command block).
Fixed by re-authenticating, then explicitly capturing the digest string from that specific
`docker push` command's own output and deploying that exact digest, rather than trusting a
mutable tag name.

---

## App had been "healthy" for 7 days with a completely empty database (Scenario C3)

**Stuck on:** A new endpoint that needed real seeded data returned a Postgres error about a
missing table, on a Swarm stack that had been reporting healthy for a full week.

**Prompt:** Asked why a long-running, apparently-healthy service would have an empty database.

**Answer:** Pointed out that `/healthz` in this app never touches the database, and the startup
check is only `SELECT 1` (which needs no tables at all) — so a genuinely empty database would
never surface as an unhealthy container in this setup.

**What actually fixed it:** Reloaded `schema.sql` and `seed.sql` directly against the live
container. The real lesson (noted in `TIMELINE.md` too): a liveness check and a "the app can
actually do its job" check are not the same thing, and this app only had the former.
