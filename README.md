# DevOps Practical Exam — Ashikur Rahman

**Exam token:** `ashik-devops-vmi3536696-1788500224-d4790b52`

**Server IP:** `169.58.246.108`

## What's hosted where

| What | Link / address |
| --- | --- |
| App (direct, Docker Compose) | http://169.58.246.108:8300 |
| App (via Swarm, `ashik_notes` stack) | http://169.58.246.108:8400 |
| App (via nginx reverse proxy, Scenario A5) | http://169.58.246.108 |
| Grafana | http://169.58.246.108:3390 |
| Prometheus | http://169.58.246.108:9390 |
| ALB / ECS (Scenario C2) | torn down after Tasks 49-54 evidence was captured, to avoid per-hour AWS cost — see `scenario-c/evidence/` for screenshots while it was live |
| Wildcard domain (Scenario C4) | not reached this submission — see `INCOMPLETE.md` |

## Repo layout

```
README.md, AI_PROMPTS.md, TIMELINE.md, INCOMPLETE.md   — top-level docs
scenario-a/   — Sessions 1-2: users/groups/ACL, bash, systemd, nginx
scenario-b/   — Sessions 3-5: Docker, compose, Prometheus/Grafana, Swarm, CI/CD
scenario-c/   — Sessions 6-9: AWS (IAM, ECS, S3, multi-tenant subdomains)
```

Each `scenario-*/ANSWERS.md` has the written answers. Each `scenario-*/evidence/` has
screenshots, named like `a1-task2-dan-cannot-cat.png`.

## Status

See `TIMELINE.md` for work log and `INCOMPLETE.md` for what's not finished.
