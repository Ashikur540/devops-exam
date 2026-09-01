# DevOps Practical Exam — [Your Name]

**Exam token:** `PASTE_YOUR_EXAM_TOKEN_HERE`
*(generate on your VPS — see "Your exam token" section in question.md, then paste it here)*

**Server IP:** `PASTE_VPS_IP_HERE`

## What's hosted where

| What | Link / address |
| --- | --- |
| App (direct) | http://SERVER_IP:PORT |
| App (via nginx) | http://SERVER_IP |
| Grafana | http://SERVER_IP:3001 |
| Prometheus | http://SERVER_IP:9090 |
| ALB (Scenario C) | http://ALB_DNS_NAME |
| Wildcard domain (Scenario C4) | http://acme.yourdomain.com |

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
