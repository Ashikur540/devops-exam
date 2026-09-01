# Scenario A — The Inherited Server — Answers

Exam token used in this scenario's screenshots: `PASTE_TOKEN`

## A1 — Team access (Tasks 1-4)

### Task 1 — Users, groups, basic permissions
_(no written answer required — evidence only, see proof table below)_

### Task 2 — dan / ACL
Why can dan list the secrets folder but not read the file inside it? (2-3 sentences)

> 

### Task 3 — carol / sticky bit or immutable
_(no written answer required beyond evidence of `rm` failing)_

### Task 4 — restart without full sudo
_(no written answer required — evidence: alice restarts service, then `sudo apt update` refused)_

### Proof table (12 checks — evidence/ screenshots)

| # | As | Command | Expected | Screenshot |
| - | -- | ------- | -------- | ---------- |
| 1 | alice | `echo test >> /srv/app/src/main.js` | works | |
| 2 | alice | `cat /srv/app/logs/app.log` | works | |
| 3 | alice | `sudo systemctl restart myapp` | works | |
| 4 | alice | `cat /srv/app/secrets/db-password.txt` | Permission denied | |
| 5 | alice | `sudo apt update` | refused by sudo | |
| 6 | carol | `echo x >> /srv/app/config/app.conf` | works | |
| 7 | carol | `cat /srv/app/secrets/db-password.txt` | works | |
| 8 | carol | `rm -f /srv/app/backups/backup1.tar` | fails | |
| 9 | dan | `ls -l /srv/app/secrets/` | shows filenames | |
| 10 | dan | `cat /srv/app/secrets/db-password.txt` | Permission denied | |
| 11 | dan | `echo x >> /srv/app/src/main.js` | Permission denied | |
| 12 | dan | `sudo systemctl restart myapp` | refused | |

---

## A2 — Who is using my port? (Tasks 5-8)

### Task 5 — Identify the process
_(evidence only: PID, binary path, user, start time, full command line)_

### Task 6 — Permission difference (`ss -lptn` / `lsof -i :8080` with vs without sudo)
Why is the output different with and without sudo?

> 

### Task 7 — Decide and act
- Started manually, by systemd, or cron? How did you find out?

> 

- If systemd, what happens with a plain `kill -9`?

> 

- (evidence: killed properly, port free)

### Task 8 — Remote access problem
Difference between "timed out" and "connection refused" — what does each tell you?

> 

---

## A3 — healthcheck.sh (Tasks 9-11)

### Task 9
_(script + config in `scenario-a/configs/`, evidence of pass + fail service)_

### Task 10 — Break it on purpose
1. Missing config file — what happened?

> 

2. Unresolvable URL (`bad|http://doesnotexist.invalid/|200`) — what happened, what did you change so it doesn't hang/crash?

> 

### Task 11 — Cron
_(evidence: `crontab -l`, two separate log entries in `/var/log/healthcheck.log`)_

---

## A4 — systemd (Tasks 12-15)

### Task 12
_(unit file in `scenario-a/configs/myapp.service`, evidence only)_

### Task 13 — Restart limit
Why would you want a restart limit in production instead of restarting forever?

> 

With `Restart=always` and no start limit, what happens differently on the same crash loop? How would you notice this in production if you weren't watching the terminal?

> 

### Task 14 — journalctl queries
List the exact command used for each (screenshot each):
1. All logs from myapp, last 10 min — `journalctl ...`
2. Errors and worse — `journalctl ...`
3. Current boot only, then previous boot — `journalctl ...`
4. JSON output — `journalctl ...`
5. Follow live while restarting — `journalctl ...`

### Task 15 — /hang and the watchdog
Why did `Restart=on-failure` not catch the hang? (one paragraph)

> 

_(evidence: watchdog timer detecting unhealthy app + auto-restart, with timestamps)_

---

## A5 — nginx (Tasks 16-20)

### Task 16 — Reverse proxy headers
_(evidence: `/whoami` showing real client IP, not 127.0.0.1)_

### Task 17 — Load balancing algorithms
Explain the difference between the default (round-robin), `least_conn`, and `ip_hash` — relate to your own 100-request count screenshots.

> 

### Task 18 — Passive health checks / failover
Using timestamps from your own loop output:
- How many requests failed before nginx stopped using the dead backend?

> 

- How long after restart did traffic return to it?

> 

- Why those numbers — relate to `max_fails` / `fail_timeout`.

> 

- Repeat with `max_fails=1`, `fail_timeout=30s` — how did the numbers change?

> 

### Task 19 — Slow endpoint / 504
Why is "just raise the timeout" usually the wrong fix? What happens to nginx worker connections if 500 users hit a 45s endpoint at once? What would you actually do in production?

> 

### Task 20 — Rate limiting
_(evidence: 50-request status code mix showing 200s and 429s)_
