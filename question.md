# EXAM

# DevOps Practical Exam

**Total:** 300 marks + 10 bonus marks
**Pass mark:** 150, and you must score at least 30% in each of the three scenarios.

---

## READ THIS PART FIRST — it will save you marks

### Using AI is allowed. Fully allowed.

You can use ChatGPT, Claude, Gemini, Copilot — anything.

### Bonus marks for showing your AI prompts (10 marks)

Create a file called `AI_PROMPTS.md`. Whenever AI genuinely helped you, write down:

- What you were stuck on
- The exact prompt you sent
- Whether the answer worked, or what was wrong with it
- What you had to change to make it work on your machine

Example of a good entry:

> **Stuck on:** nginx returning 502 after adding my second backend.
> **Prompt:** “nginx reverse proxy returns 502 bad gateway, backend is running on port 3001 and curl localhost:3001 works from the server. here is my config: [pasted config]”
> **Answer:** It told me to check `proxy_pass` and SELinux. SELinux was not the issue on Ubuntu.
> **What actually fixed it:** My upstream block said `server localhost:3001;` and nginx resolved `localhost` to `::1` (IPv6), but my app only listened on IPv4. Changed it to `127.0.0.1:3001`. AI did not catch this — I found it with `ss -lntp`.

That entry earns full bonus marks because it shows you understood the gap between the generic answer and your real problem.

**Minimum 8 entries for the full 10 marks.** Pasting prompts without saying what went wrong earns 2 marks.

### Your exam token — run this FIRST

Before you touch anything else, log into your server and run this:

```bash
export EXAM_TOKEN="$(whoami)-$(hostname)-$(date +%s)-$(head -c4 /dev/urandom | xxd -p)"
echo "$EXAM_TOKEN" | tee ~/exam_token.txt
echo "export EXAM_TOKEN=\"$EXAM_TOKEN\"" >> ~/.bashrc
```

This gives you a unique string like `ubuntu-vps01-1735689600-a3f9c1e2`.

**Every screenshot you submit must show this token.** Before you take any screenshot, run this in the same terminal so it appears in the frame:

```bash
echo "$EXAM_TOKEN |$(date)"
```

Then run your actual command and screenshot the whole terminal window.

**Screenshots without the token score zero.**

For screenshots taken in a browser or cloud console (Grafana, GitHub, AWS), put the token somewhere visible instead: the dashboard title, a comment in the workflow file, or an open terminal beside the browser window.

Put your token at the top of your `README.md` as well.

### What you submit

One GitHub repository. Public, or private with me added as a collaborator. Structure:

```
README.md                 your name, exam token, server IP, links to anything hosted
AI_PROMPTS.md             your AI prompt log (bonus marks)
TIMELINE.md               your work diary (marks)
INCOMPLETE.md             everything you did not finish (marks — read the section below)

scenario-a/
    ANSWERS.md            your written answers for Scenario A
    configs/              nginx conf, systemd unit files, scripts
    evidence/             screenshots, named like a1-task2-dan-cannot-cat.png

scenario-b/
    ANSWERS.md
    app/                  your application code
    docker/               Dockerfile, compose files
    grafana/              dashboard JSON export
    .github/workflows/    (or at repo root, your choice)
    evidence/

scenario-c/
    ANSWERS.md
    evidence/
```

**A task you failed but diagnosed correctly earns up to 60% of its marks. A task you skipped silently earns 0.**

### Instant zero rules

- `chmod 777` anywhere, or `-privileged` on a container: zero for that task
- AWS keys, passwords, or `.env` files committed to the repo: zero for that scenario
- Port 22 open to `0.0.0.0/0` in a security group you created: zero for that task
- A single commit containing everything: minus 20 marks. I want to see at least 15 commits showing real progress

### Viva

There is no scheduled viva. **But** if something in your submission looks like you did not do it yourself — a dashboard with no data, a config you could not have written, answers that do not match your own screenshots — I will call you in and ask you to explain and modify your own work live. If you cannot, those tasks go to zero.

---

# SCENARIO A — The Inherited Server (82 marks)

_Covers Session 1 and 2: users, groups, permissions, ACL, bash scripting, port debugging, systemd, journalctl, nginx reverse proxy, load balancing._

## The situation

You just joined a company. The sysadmin who set everything up left last month without documenting anything. You have been handed root access to one VPS and told “the app runs on there, make it manageable and do not break it.”

You need to set up proper access for the team, get the app running as a proper service, and put nginx in front of it.

Use any VPS you have. Ubuntu 22.04 or 24.04 is easiest and my examples assume it.

---

## A1 — Set up team access (20 marks)

Four people need access to the server. Right now everybody shares the root password. Fix that.

### The people

| Person     | Group     | What they need                                                                                                                                        |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| alice, bob | `devs`    | Read and edit the app source code. Read the app logs. Restart the app service.                                                                        |
| carol      | `ops`     | Everything devs can do, plus edit the config folder, plus read the secrets file.                                                                      |
| dan        | `auditor` | Read-only on everything under `/srv/app`. He must be able to **list** the secrets folder and see the filenames, but **not read what is inside** them. |

### Directory layout to create

```
/srv/app/src/        application source code
/srv/app/config/     configuration files
/srv/app/secrets/    put a file called db-password.txt inside, with any fake password
/srv/app/logs/       log files
/srv/app/backups/    put 2-3 dummy backup files inside
```

### Task 1 (6 marks) — Users, groups and basic permissions

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Create the four users and three groups. Set ownership and permissions on the directories so the table above works.

### Task 2 (5 marks) — The dan problem, using ACL

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

dan needs to run `ls -l /srv/app/secrets/` and see this:

```
-rw-r----- 1 root ops 27 db-password.txt
```

But when he runs `cat /srv/app/secrets/db-password.txt` he must get `Permission denied`.

### Task 3 (4 marks) — The carol problem

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

carol owns `/srv/app/backups` and has write permission on it. Normally that means she can `rm -rf` the whole thing. Your job is to make sure she **cannot delete the backup files**, even though she owns the directory.

You must show carol actually trying `rm` and failing.

### Task 4 (5 marks) — Restart without full sudo

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

alice and bob need to restart the app service. They must **not** get full `sudo` — they should not be able to run `sudo apt install`, `sudo su`, or edit files as root.

Then prove it: become alice, restart the service successfully, then try `sudo apt update` and show it being refused.

### What to submit for A1

1. **`scenario-a/evidence/`** — a proof table. For each of these 12 checks, one screenshot (or one captured terminal session file) showing the command and the result:

| #   | As user | Command                                | Expected          |
| --- | ------- | -------------------------------------- | ----------------- |
| 1   | alice   | `echo test >> /srv/app/src/main.js`    | works             |
| 2   | alice   | `cat /srv/app/logs/app.log`            | works             |
| 3   | alice   | `sudo systemctl restart myapp`         | works             |
| 4   | alice   | `cat /srv/app/secrets/db-password.txt` | Permission denied |
| 5   | alice   | `sudo apt update`                      | refused by sudo   |
| 6   | carol   | `echo x >> /srv/app/config/app.conf`   | works             |
| 7   | carol   | `cat /srv/app/secrets/db-password.txt` | works             |
| 8   | carol   | `rm -f /srv/app/backups/backup1.tar`   | fails             |
| 9   | dan     | `ls -l /srv/app/secrets/`              | shows filenames   |
| 10  | dan     | `cat /srv/app/secrets/db-password.txt` | Permission denied |
| 11  | dan     | `echo x >> /srv/app/src/main.js`       | Permission denied |
| 12  | dan     | `sudo systemctl restart myapp`         | refused           |

You can combine several checks into one screenshot as long as everything is readable. Each missing check loses marks.

1. **In `ANSWERS.md`:** explain in your own words why dan can list the folder but not read the file. Two or three sentences.

---

## A2 — Who is using my port? (12 marks)

### The situation

You try to start your app on port 8080 and get:

```
Error: listen EADDRINUSE: address already in use :::8080
```

Something else is already using that port. You have no idea what. Nobody documented it. You need to find out what it is, who started it, and decide whether you can kill it.

### Set it up yourself

Before you start investigating, create the mystery yourself so you have something real to investigate:

```bash
# Terminal 1 — start something on 8080 as root
sudo python3 -m http.server 8080
```

Leave that running. Now open a second terminal and investigate from there. Also start a second one as a normal user on a different port so you can compare:

```bash
# Terminal 2 — start something on 9090 as your normal user
python3 -m http.server 9090
```

### Task 5 (4 marks) — Identify the process

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Find out, for port 8080:

- Which PID is holding it
- Which program it is (full path to the binary)
- Which user started it
- When it was started
- What the full command line was

### Task 6 (3 marks) — The permission difference

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Run `ss -lptn` and `lsof -i :8080` **without sudo**, then **with sudo**. The output is different. Explain why in `ANSWERS.md`.

### Task 7 (3 marks) — Decide and act

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Answer in `ANSWERS.md`:

- Was this process started manually, by systemd, or from cron? How did you find out?
- If it was started by systemd, what happens if you just `kill -9` the PID?
- Kill it properly (the right way depends on your answer above) and show port 8080 is now free.

### Task 8 (2 marks) — The remote access problem

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Now start your own app on 8080. From the server itself, `curl localhost:8080` works. But from your laptop, `curl http://<server-ip>:8080` times out or is refused.

Note the difference between “timed out” and “connection refused” — they tell you different things. Explain the difference in `ANSWERS.md`.

### What to submit for A2

- Screenshots of all commands with output, in `scenario-a/evidence/`
- Written answers in `scenario-a/ANSWERS.md` for tasks 6, 7 and 8

---

## A3 — A bash script you would actually use (12 marks)

### The situation

You need to know when your servers are unhealthy without watching them all day. Write a real monitoring script — the kind you would actually put in cron.

### Task 9 (8 marks) — Write `healthcheck.sh`

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

The script reads a config file listing services to check, checks each one, and reports.

**Config file** — `checks.conf`:

```
# format: name|url|expected_http_code
app-1|http://127.0.0.1:3001/healthz|200
app-2|http://127.0.0.1:3002/healthz|200
nginx|http://127.0.0.1/|200
# blank lines and comments must be ignored
```

**The script must:**

1. Take the config file path as an argument. If not given, default to `./checks.conf`.
2. Skip blank lines and lines starting with `#`.
3. For each service, use `curl` with a **3 second timeout** and check the returned HTTP status code.
4. Also check disk usage — if `/` is over 80% full, report it as a warning.
5. Print a coloured summary to the terminal (green OK, red FAIL) and write full details with timestamps to `/var/log/healthcheck.log`.
6. Exit with code `0` if everything is fine, `1` if any service failed, `2` if the config file is missing or unreadable.
7. Not run twice at the same time — if cron starts a second copy while the first is still running, the second should exit quietly.

### Task 10 (2 marks) — Break it on purpose

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Test your script against bad input and show what happens:

1. Point it at a config file that does not exist → should exit 2
2. Add a line with a URL that does not resolve at all, e.g. `bad|http://doesnotexist.invalid/|200` → the script should not hang or crash

Document both in `ANSWERS.md`: what you did, what happened, what you changed.

### Task 11 (2 marks) — Put it in cron

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Add a crontab entry to run it every 5 minutes. Show `crontab -l` and show log entries appearing in `/var/log/healthcheck.log` from at least two separate runs.

### What to submit for A3

- `scenario-a/configs/healthcheck.sh` and `checks.conf`
- Screenshot of the script running, showing both a passing and a failing service
- Screenshot of `crontab -l` and `tail /var/log/healthcheck.log`
- Both break tests documented in `ANSWERS.md`

---

## A4 — Run your app properly with systemd (22 marks)

### First, you need an app

Write the simplest possible web app in whatever language you like. It needs:

- `GET /` → returns text including its own port and hostname
- `GET /healthz` → returns 200 OK
- `GET /slow` → waits 45 seconds, then returns 200 (you will need this in A5)
- `GET /crash` → makes the process exit with a non-zero code (you will need this here)
- `GET /hang` → makes the app stop responding forever but stay alive (you will need this)
- It reads its port from an environment variable `PORT`

Node.js example of the tricky endpoints:

```jsx
app.get("/crash", (req, res) => {
  res.send("bye");
  setTimeout(() => process.exit(1), 100);
});

app.get("/slow", async (req, res) => {
  await new Promise((r) => setTimeout(r, 45000));
  res.send("finally");
});

let hung = false;
app.get("/hang", (req, res) => {
  res.send("now hanging");
  hung = true;
});
// add this check at the top of your other routes:
// if (hung) { return new Promise(() => {}); }   // never resolves
```

Any language is fine — Python, Go, PHP. It just needs those five endpoints.

### Task 12 (10 marks) — Write the systemd unit

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Create `/etc/systemd/system/myapp.service`. It must have:

1. **A dedicated system user** — create a user that cannot log in:

   ```bash
   sudo useradd --system --no-create-home --shell /usr/sbin/nologin myappuser
   ```

   The service runs as this user, not root, not your user.

2. **Restart on failure, but with a limit.** If the app crashes 5 times within 60 seconds, systemd should give up and mark it `failed` instead of restarting forever.
3. **Start ordering** — the service must start after the network is genuinely up and after PostgreSQL (install postgres if you do not have it, or use nginx as the dependency).
4. **A log identifier** so you can filter its logs: `SyslogIdentifier=myapp`

### Task 13 (4 marks) — Trigger the restart limit

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

You need to crash the app 6 times quickly. That is what the `/crash` endpoint is for:

```bash
for i in $(seq 1 6); do
  curl -s localhost:3000/crash
  sleep 2
done
systemctl status myapp
```

After the sixth crash the service should be in `failed` state, not restarting. Show:

- `systemctl status myapp` showing `failed` and a message about the start request repeating too quickly
- `journalctl -u myapp -n 40` showing the crash loop and systemd giving up

**In `ANSWERS.md`:** why would you want this limit in production instead of restarting forever?

**Then change the unit to `Restart=always` with no start limit, and run the same crash loop again.** What happens differently? Screenshot it. In `ANSWERS.md`, say how you would notice this in production if you were not watching the terminal.

### Task 14 (4 marks) — journalctl queries

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Give the exact command and screenshot the output for each:

1. All logs from `myapp` in the last 10 minutes
2. Only errors and worse
3. Logs from the current boot only, then from the previous boot
4. Output in JSON format
5. Follow logs live while you restart the service

### Task 15 (4 marks) — The app that is alive but dead

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Hit `/hang`. Your app is now stuck — it accepts connections but never replies. But `systemctl status myapp` still says `active (running)`, because the process is alive.

This is a real and common situation. `Restart=on-failure` does nothing here, because nothing failed.

Fix it.

**Option A (simpler)** — a systemd timer that runs a health check every 30 seconds and restarts the service if it fails:

```bash
# /usr/local/bin/myapp-watchdog.sh
curl -sf --max-time 5 http://127.0.0.1:3000/healthz || systemctl restart myapp
```

Then create `myapp-watchdog.service` and `myapp-watchdog.timer`.

**Prove it:** hit `/hang`, then show with timestamps that the service was detected as unhealthy and automatically restarted.

In `ANSWERS.md`, explain in one paragraph why `Restart=on-failure` did not catch this.

---

## A5 — nginx reverse proxy and load balancing (16 marks)

### Setup

Run **two** copies of your app on different ports.

Make sure your `/` endpoint returns the port and IP it is running on, and which backend the response came from, e.g. `Hello from backend on port 3001`. You need this to tell them apart.

Install nginx. Everything below goes in `/etc/nginx/sites-available/myapp` or `/etc/nginx/conf.d/myapp.conf`.

### Task 16 (3 marks) — Reverse proxy with correct headers

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Make nginx on port 80 forward requests to your app.

The problem: without extra config, your app thinks every request came from `127.0.0.1`, because nginx is the one connecting to it. Your app can no longer see the real visitor’s IP. Fix this with proxy headers.

**Prove it works.** Add an endpoint that echoes back what it received:

```jsx
app.get("/whoami", (req, res) => {
  res.json({
    remoteAddress: req.socket.remoteAddress,
    headers: req.headers,
  });
});
```

### Task 17 (3 marks) — Load balance across both backends

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

**How to prove the traffic is being split.** Send 100 requests and count how many hit each backend:

```bash
for i in $(seq 1 100); do curl -s http://localhost/ ; echo; done | sort | uniq -c
```

Your app returns its port in the response, so `uniq -c` gives you a count per backend.

Screenshot that output. Then try another algorithm (`least_conn;` or `ip_hash;`) and show how the counts change. Explain the difference in `ANSWERS.md`.

### Task 18 (4 marks) — Health checks and failover

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

nginx open source does **passive** health checks — it does not poll your backends, it just notices when requests to them fail and takes them out of rotation for a while.

**The test:**

1. Start a continuous request loop in one terminal:

   ```bash
   while true; do
     echo "$(date +%T)$(curl -s --max-time 2 http://localhost/ || echo FAILED)"
     sleep 0.5
   done
   ```

2. In another terminal, kill backend 3002 (`kill` the process or `systemctl stop`).
3. Watch the loop output. You should see a few failures or 502s, then all responses coming from 3001 only.
4. Start 3002 again. Watch it come back into rotation.

**Answer in `ANSWERS.md` using timestamps from your own loop output:**

- How many requests failed before nginx stopped using the dead backend?
- How long after you restarted it did traffic return to it?
- Why those specific numbers? Relate them to your `max_fails` and `fail_timeout` settings.
- Change `max_fails` to 1 and `fail_timeout` to 30s, repeat, and report how the numbers changed.

### Task 19 (3 marks) — The slow endpoint and the 504

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Your app has a `/slow` endpoint that takes 45 seconds. Through nginx:

```bash
time curl http://localhost/slow
```

nginx’s default `proxy_read_timeout` is 60s, so depending on your setup you may or may not hit it. **Make it fail on purpose** by setting the timeout low.

Now `/slow` definitely returns 504. Screenshot it.

Then fix it by raising the timeout so the request succeeds. Screenshot the success.

**Now the real question, in `ANSWERS.md`:** raising the timeout is what everyone does first, and it is usually the wrong fix. Explain why. Think about what happens to your nginx worker connections if 500 users all hit a 45-second endpoint at once. What would you do instead in a real production system?

### Task 20 (3 marks) — Rate limiting with nginx

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Protect your API so one IP cannot hammer it.

**Prove it.** Fire 50 requests as fast as possible and count the status codes:

```bash
for i in $(seq 1 50); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/notes
done | sort | uniq -c
```

You should see a mix of `200` and `429`. Screenshot it.

### What to submit for A5

- `scenario-a/configs/nginx-myapp.conf` — your full final config, commented
- Screenshot of `/whoami` from your laptop showing your real IP
- Screenshot of the 100-request distribution count
- Screenshot or pasted log of the failover loop with timestamps
- Screenshot of the 504 and then the success
- Written answers in `ANSWERS.md` for tasks 17, 18 and 19

---

# SCENARIO B — Containerize, Ship and Observe (124 marks)

_Covers Session 3, 4, 5 plus Prometheus and Grafana._

## The application you will build

A small **multi-tenant Notes API** with PostgreSQL behind it. Multi-tenant means several customers share one database, and every query must filter by tenant.

You can reuse the app from Scenario A and extend it, or start fresh. Any language.

### Database schema (minimum)

```sql
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL       -- e.g. 'acme', 'globex'
);

CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  note_id INT NOT NULL REFERENCES notes(id),
  name TEXT NOT NULL
);
```

### Endpoints

```
POST /api/notes            create a note
GET  /api/notes            list notes, paginated  (?page=1&limit=20)
GET  /api/notes/:id        one note
GET  /api/search?q=word    search note bodies
GET  /api/stats            counts per tenant, joining all three tables
GET  /healthz              always returns 200 if the process is alive
GET  /readyz               returns 200 only if the DB query succeeds
GET  /metrics              Prometheus metrics (you build this in B3)
```

Tenant is identified by a header for now: `X-Tenant: acme`. Every query must include `WHERE tenant_id = ...`.

### Seed data

Write a seeder script that creates:

- 5 tenants
- **50,000 notes** spread across them, unevenly — give one tenant 30,000 and the rest fewer, you will need this later
- **150,000 tags**

Use random words in `body` so search has something to find. Generate them in batches, not one INSERT at a time, or it will take forever.

Postgres can generate this for you very fast:

```sql
INSERT INTO notes (tenant_id, title, body)
SELECT (random()*4+1)::int,
       'Note ' || g,
       md5(random()::text) || ' ' || md5(random()::text)
FROM generate_series(1, 50000) g;
```

Commit the seeder. You need real data volume.

### Deliberate problems you must LEAVE IN the app

These are on purpose. You will find them with monitoring later and fix one of them.

**Problem 1 — the N+1 query.** Your `GET /api/notes` endpoint must fetch the notes with one query, then loop over them and fetch tags with one query per note:

```jsx
// GET /api/notes — DELIBERATELY BAD, keep it this way
app.get("/api/notes", async (req, res) => {
  const limit = req.query.limit || 20;
  const notes = await db.query(
    "SELECT * FROM notes WHERE tenant_id=$1 LIMIT $2",
    [tenantId, limit],
  ); // 1 query

  for (const note of notes.rows) {
    // then N more queries
    const tags = await db.query("SELECT name FROM tags WHERE note_id=$1", [
      note.id,
    ]);
    note.tags = tags.rows.map((t) => t.name);
  }

  res.json(notes.rows);
});
```

With `limit=20` this runs **21 queries** instead of 2. That is the N+1 problem. The correct version would be one query with a `JOIN`, or one `WHERE note_id = ANY($1)`. Do **not** fix it yet.

**Problem 2 — unindexed search.** `/api/search` uses `WHERE body LIKE '%' || $1 || '%'` with no index. This forces Postgres to read every row.

**Problem 3 — missing foreign key index.** Do not create an index on `tags.note_id`. Postgres does not create one automatically for foreign keys. This makes `/api/stats` slow.

**Problem 4 — unbounded limit.** `/api/notes` accepts `?limit=50000` and happily returns 50,000 rows.

---

## B1 — Build the Docker image (18 marks)

### Task 21 (6 marks) — Multi-stage Dockerfile

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Write a Dockerfile with at least two stages. The final image must:

- Contain no compiler, build tools, or dev dependencies
- Run as a non-root user
- Have a working `HEALTHCHECK` instruction

**Prove non-root:**

```bash
docker run --rm myapp:v1 whoami        # must NOT say root
docker run --rm myapp:v1 id
```

**Prove the healthcheck works:**

```bash
docker run -d --name hc myapp:v1
docker ps                              # STATUS column should say (healthy)
docker inspect --format='{{json .State.Health}}' hc | jq
```

### Task 22 (4 marks) — Make it smaller

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

First write a **naive single-stage Dockerfile** (`Dockerfile.naive`) and build it, then build your multi-stage one.

Screenshot showing both sizes. Your multi-stage image must be **at least 60% smaller**.

In `ANSWERS.md`, list what you removed and what you gave up by removing it.

### Task 23 (4 marks) — Layer caching

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Change one line in your source file (add a comment), then rebuild:

```bash
time docker build -t myapp:multi .
```

Look at the build output — it says `CACHED` next to layers it reused. Note which layers were rebuilt.

**Submit:** both `time` outputs in the same screenshot, and an explanation of which layers changed and why.

### Task 24 (2 marks) — Find the biggest layer

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

```bash
docker history myapp:multi
docker history --no-trunc --format "{{.Size}}\t{{.CreatedBy}}" myapp:multi
```

Which layer is biggest? What command created it? Could it be smaller? Answer in `ANSWERS.md`.

### Task 25 (2 marks) — Prove there are no secrets in the image

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Here is the trap. This Dockerfile looks safe but is not:

```docker
COPY .env /app/.env
RUN cat /app/.env > /dev/null && rm /app/.env      # "deleted" — but not really
```

Deleting a file in a later layer does **not** remove it from earlier layers. Anyone with the image can extract it.

Screenshot showing your search returned nothing, and explain in `ANSWERS.md` why `rm` in a later layer does not help.

---

## B2 — Compose, storage and debugging (18 marks)

### Task 26 (5 marks) — The compose file

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Write `docker-compose.yml` with four services: `app`, `postgres`, `prometheus`, `grafana`.

**The important part:** your app must not start until Postgres is genuinely ready to accept queries.

`depends_on: [postgres]` alone only waits for the _container to start_, not for Postgres to be _ready_. Postgres takes several seconds to initialise. Your app will start, try to connect, and crash.

**Prove that `depends_on` alone is insufficient:** write a version with only `depends_on`, run `docker compose up` on a fresh volume, and screenshot your app crashing with a connection error.

Then screenshot the fixed version starting cleanly.

### Task 27 (5 marks) — Volumes and persistence

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

1. Start everything, create some notes via your API.
2. Run `docker compose down` then `docker compose up -d`. Show the notes are still there.
3. Now run `docker compose down -v`, then `up -d`. Show the notes are **gone** and explain in `ANSWERS.md` what the `v` flag did.
4. **Recovery:** show a backup and restore that would have saved you. Show the data coming back after a `down -v`.

### Task 28 (8 marks) — The debugging drill, 2 marks each

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

For each of these four situations you must **cause it yourself**, then diagnose and fix it. For each one submit: what you changed to cause it, the symptom, the exact command that revealed the cause, and the fix.

---

**a. Container exits with code 137**

_How to cause it:_ give the container a tiny memory limit and then make it use memory.

```yaml
deploy:
resources:
limits:
memory: 50M
```

Then in your app allocate a big array, or just run:

```bash
docker run --memory=50m --rm python:3-alpine python -c "x=[0]*100000000"
```

_Find it with:_

```bash
docker inspect --format='{{.State.OOMKilled}}' <container>     # true
dmesg | tail -20                                               # kernel OOM killer log
docker stats
```

_What you should understand:_ 137 = 128 + 9, meaning killed by signal 9 (SIGKILL). Combined with `OOMKilled: true` it means the kernel killed it for using too much memory. Note that 143 (128 + 15, SIGTERM) means something asked it to stop politely.

---

**b. App cannot reach the DB by service name but can by IP**

_How to cause it:_ put the app and postgres on **different Docker networks**, or run the app with `docker run` on the default bridge network while postgres is in a compose project.

_Find it with:_

```bash
docker network ls
docker inspect <container> --format '{{json .NetworkSettings.Networks}}' | jq
docker compose exec app getent hosts postgres      # fails
docker compose exec app ping -c1 172.18.0.3        # works
```

_What you should understand:_ Docker’s built-in DNS only resolves service names for containers on the same user-defined network. The old default `bridge` network has no DNS at all.

---

**c. Volume mounted but the app sees an empty directory**

_How to cause it:_ mount a host directory over a path that your image already populated:

```yaml
volumes:
  - ./empty-folder:/app/node_modules
```

_Find it with:_

```bash
docker compose exec app ls -la /app/node_modules   # empty
docker inspect <container> --format '{{json .Mounts}}' | jq
```

_What you should understand:_ a bind mount **hides** whatever was at that path in the image. It does not merge. Named volumes behave differently on first creation — find out how, and mention it in your answer.

---

**d. Port published but connection refused from the host**

_How to cause it:_ make your app listen on `127.0.0.1:3000` inside the container instead of `0.0.0.0:3000`.

---

**Submit for task 28:** one section per letter in `ANSWERS.md` with your four points, plus screenshots in `evidence/`.

---

## B3 — Instrumentation, Prometheus and Grafana (32 marks)

### Background: what you are doing and why

Right now you have no idea which part of your app is slow. You are going to make the app report numbers about itself, collect those numbers with Prometheus, and draw graphs in Grafana. Then you will use those graphs to find the four problems you deliberately left in.

This is exactly what you do on a real system when a customer says “the site is slow.”

### Task 29 (6 marks) — Add metrics to your app

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Install a Prometheus client library for your language:

- Node: `prom-client`
- Python: `prometheus_client`
- Go: `prometheus/client_golang`
- PHP / Laravel: `promphp/prometheus_client_php`, or the `spatie/laravel-prometheus` package

You must expose these at `GET /metrics`:

| Metric                          | Type      | Labels                                | Why                               |
| ------------------------------- | --------- | ------------------------------------- | --------------------------------- |
| `http_requests_total`           | Counter   | `route`, `method`, `status`, `tenant` | request volume and error rate     |
| `http_request_duration_seconds` | Histogram | `route`, `method`, `tenant`           | latency, lets you compute p95     |
| `db_query_duration_seconds`     | Histogram | `query_name`                          | which query is slow               |
| `db_queries_per_request`        | Histogram | `route`                               | **this is how you catch the N+1** |
| `db_rows_returned`              | Histogram | `query_name`                          | catches the unbounded limit       |
| `http_requests_in_flight`       | Gauge     | —                                     | saturation                        |

**Critical detail about the `route` label:** use the route _pattern_, not the actual URL. Use `/api/notes/:id`, never `/api/notes/48213`. If you use the real path you create one metric series per note ID, giving you 50,000 series and a dead Prometheus. This mistake is called high cardinality and it is one of the most common real-world monitoring failures.

**Submit:** screenshot of `curl localhost:3000/metrics | head -50` showing your metrics, plus a few log lines.

### Task 30 (3 marks) — Wire up Prometheus

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Add it to your compose file, mount the config, expose port 9090.

**Submit:** screenshot of `http://localhost:9090/targets` showing your app as **UP**, and a screenshot of a query returning data.

### Task 31 (5 marks) — Generate load

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

You cannot see anything in a dashboard without traffic. You need to hammer your API for several minutes.

**The simplest option — a bash loop.** No installation needed:

```bash
#!/bin/bash
# loadtest.sh
END=$((SECONDS+300))
TENANTS=(acme globex initech umbrella hooli)
while [ $SECONDS -lt $END ]; do
  T=${TENANTS[$RANDOM % 5]}
  curl -s -o /dev/null -H "X-Tenant:$T" "http://localhost:3000/api/notes?limit=20" &
  curl -s -o /dev/null -H "X-Tenant:$T" "http://localhost:3000/api/search?q=abc" &
  curl -s -o /dev/null -H "X-Tenant:$T" "http://localhost:3000/api/stats" &
  curl -s -o /dev/null -H "X-Tenant:$T" "http://localhost:3000/api/notes/1" &
  sleep 0.2
done
wait
```

**Better option — `hey`**, a single binary:

```bash
# install: go install github.com/rakyll/hey@latest   (or download the binary)
hey -z 5m -c 20 -H "X-Tenant: acme" "http://localhost:3000/api/notes?limit=20"
```

- `z 5m` means run for five minutes. `c 20` means twenty concurrent users.

**Requirements:**

- Run for at least five minutes
- Hit all the endpoints, not just one
- Use at least three different tenants
- Include a **burst** in the middle: run your normal load, and partway through launch a second heavy load process for about 30 seconds, then stop it. You need this spike for one of the dashboard panels.
- Make one tenant deliberately worse — send that tenant much heavier requests, e.g. `?limit=5000`, so it shows up as the slow tenant in your dashboard

**Submit:** your load script, and the summary output from your load tool.

### Task 32 (12 marks) — Build the Grafana dashboard

_Put your exam token in the dashboard name so it appears in every panel screenshot._

Add Grafana to compose (port 3001, default login admin/admin), add Prometheus as a data source, and create **one dashboard** named `exam-<YOUR_EXAM_TOKEN>`.

Build these nine panels. For **each** panel, submit a screenshot showing real data, and the PromQL you used (put it in `ANSWERS.md`).

**Panel A — Top 5 slowest endpoints by p95 latency**

p95 means “95% of requests were faster than this.” It is more useful than an average because averages hide the slow tail.

**Panel B — Which endpoint consumed the most TOTAL time**

This is a different question from Panel A and it is the most important panel in this whole exam.

Panel A tells you which endpoint is slowest _per request_. Panel B tells you where your server’s time is actually going.

An endpoint that takes 5 seconds but is called twice an hour is less important than an endpoint that takes 200ms but is called 500 times a second. **In `ANSWERS.md`, state which endpoint wins each panel on your system, and explain in your own words why they are different.**

**Panel C — Average and p99 DB query duration by query name**

Put both on the same panel so you can see the gap between them.

**Panel D — The slowest single query, and how often it runs**

Two series on one panel or a table: the p99 duration per query name, and how often each runs. Answer in `ANSWERS.md`: which query is slowest, and is it also the most frequent?

**Panel E — The N+1 detector**

This shows how many DB queries each request makes. `/api/notes` with `limit=20` should show around **21**, while every other endpoint shows 1 or 2. That number is the N+1 problem being visible.

Screenshot this panel with `/api/notes` clearly standing out.

**Panel F — Harmful queries over time**

Count queries that took longer than a threshold you choose, using histogram buckets. This gives you “queries per second slower than X”.

**Justify your threshold with a real number from your own data.** Do not pick 100ms because it is round. Look at Panel C, see what your normal query time is, and pick a threshold that is clearly abnormal for _your_ system. Write the reasoning in `ANSWERS.md`.

**Panel G — Rows returned distribution**

This should expose Problem 4 — someone calling `?limit=5000` and getting 5000 rows. Answer in `ANSWERS.md`: what would you set as a maximum limit, and what should the API do when a client asks for more?

**Panel H — Error rate and latency by tenant**

Error rate, plus p95 latency grouped by tenant instead of route.

One tenant should look clearly worse than the others. **Explain why in `ANSWERS.md`** — is it because they have more data, or because they are sending heavier requests? Prove which one using your own data.

**Panel I — Saturation: in-flight requests vs latency**

**In `ANSWERS.md`:** did latency go up at the same time as concurrency, or was there a delay? What does that tell you about where the bottleneck is?

**Also submit:** your dashboard exported as JSON (Dashboard settings → JSON Model → copy) saved to `scenario-b/grafana/dashboard.json`.

### Task 33 (3 marks) — An alert that actually fires

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Create a Grafana alert rule: fire when p95 latency on any route goes above a threshold for a sustained period.

You choose the threshold and the `for` duration. Then **make it fire** by running heavy load, and screenshot the alert in `Firing` state.

In `ANSWERS.md`:

- What threshold did you pick and why? Base it on your normal p95 from Panel A.
- What `for` duration did you pick? What happens if you set `for: 0s`? What problem does a longer `for` solve?

### Task 34 (3 marks) — Fix one problem and prove it

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Pick **one** of the four deliberate problems. Fix it. Show the before and after on the same Grafana panel.

The easiest one to show dramatically is Problem 3, the missing index. Or fix the N+1 by replacing the loop with:

```sql
SELECT * FROM tags WHERE note_id = ANY($1)   -- one query for all notes
```

**Submit:**

1. `EXPLAIN ANALYZE` output before and after — this is the real proof
2. A Grafana panel screenshot covering both periods, with the improvement visible. Add an annotation in Grafana marking the moment you deployed the fix.
3. **What did the fix cost?** An index makes reads faster but writes slower and takes disk space. Measure something: `SELECT pg_size_pretty(pg_relation_size('idx_tags_note_id'));` or time an INSERT before and after.
4. Which problem would you fix next, and what would you need to measure first to decide?

---

## B4 — Docker Swarm: scaling and rollback (26 marks)

### Setup

Single node is fine. Multi-node scores better — if you have two VPS, join them.

```bash
docker swarm init --advertise-addr <your-server-ip>
docker node ls
```

You need your image in a registry that Swarm can pull from. Push to Docker Hub (free) or GHCR:

```bash
docker tag myapp:v1 <yourname>/notes-api:v1
docker push <yourname>/notes-api:v1
```

### Task 35 (3 marks) — Deploy the stack

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

**Submit:** screenshot of `docker stack services notes` showing replicas running, and `docker node ls`. State clearly in `ANSWERS.md` whether you used one node or more.

### Task 36 (4 marks) — Scale to 5 replicas and prove it

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

```bash
docker service scale notes_app=5
docker service ps notes_app
```

**Proving all 5 are actually serving traffic:** your app must return its own hostname. Inside a container the hostname is the container ID.

```jsx
res.setHeader("X-Served-By", require("os").hostname());
```

Then:

```bash
for i in $(seq 1 50); do
  curl -s -o /dev/null -D - http://localhost:3000/healthz | grep X-Served-By
done | sort | uniq -c
```

You should see 5 different hostnames. Screenshot it.

If you only see one, find out why. Hint: keep-alive connections reuse the same backend — try `curl -H "Connection: close"`.

### Task 37 (7 marks) — Rolling update with zero downtime

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

`order: start-first` is the key setting for zero downtime — the default `stop-first` removes a container before the replacement is ready.

**The test:**

1. Start a continuous traffic loop in one terminal and log every status code:

   ```bash
   while true; do
     printf "%s %s\n" "$(date +%T)" \
       "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/healthz)"
     sleep 0.2
   done | tee update-log.txt
   ```

2. In another terminal, deploy v2. Change something visible first, like a version string in the response.

   ```bash
   docker service update --image <yourname>/notes-api:v2 notes_app
   ```

3. Watch `docker service ps notes_app` while it rolls.
4. When it finishes, count the failures:

   ```bash
   awk '{print $2}' update-log.txt | sort | uniq -c
   ```

**Submit:** the count output. If you got any non-200s, **say so honestly** and explain why — that earns more marks than claiming zero without proof. Common causes: no healthcheck, so Swarm routed traffic to a container that was not ready yet; `stop-first` ordering; or no graceful shutdown handler in your app.

### Task 38 (6 marks) — Break v3 and let Swarm roll back

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Build a v3 that is deliberately broken. Easiest ways:

- Make the app `process.exit(1)` on startup
- Make `/healthz` return 500 so the container healthcheck never passes

Then deploy it:

```bash
docker service update --image <yourname>/notes-api:v3 notes_app
```

Watch it happen:

```bash
watch -n1 docker service ps notes_app
docker service inspect notes_app --format '{{json .UpdateStatus}}' | jq
```

**Submit:**

- Screenshot of `docker service ps` during the failure showing tasks in `Failed` or `Rejected` state
- Screenshot after, showing it back on v2
- Screenshot of `UpdateStatus` showing `rollback_completed`
- **How long** from the deploy command to full rollback? Use the timestamps in `docker service ps`.
- In `ANSWERS.md`: what would have happened if your image had no healthcheck? Would Swarm have noticed?

### Task 39 (3 marks) — Resource limits vs reservations

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

**Prove the difference:** raise the reservation to something your node cannot satisfy, e.g. `memory: 8G` on a 2GB VPS, then scale up. Swarm cannot place the task.

```bash
docker service ps notes_app --no-trunc
```

**Submit:** that screenshot, plus an explanation in your own words of what you observed and how limit differs from reservation.

### Task 40 (3 marks) — Scale down during live traffic

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

With your traffic loop running, scale from 5 to 2. Count the failures in your loop.

**Submit:** the failure count.

---

## B5 — CI/CD with GitHub Actions (30 marks)

### What you are building

Right now you deploy by SSHing into the server and typing commands. That does not scale and it is how outages happen. You will build a pipeline that tests, builds, and deploys automatically.

### Task 41 (6 marks) — The pull request pipeline

_Put your exam token in a comment at the top of the workflow file so it appears in screenshots._

Create `.github/workflows/pr.yml` that runs on every pull request and does:

1. Check out the code
2. Run unit tests — write at least 3 real tests; testing that your app returns 200 on `/healthz` counts
3. Build the Docker image
4. **Start the image and actually curl `/healthz` against it** — this catches images that build fine but do not run
5. Fail the whole workflow if any step fails

**What to submit:** a link to a PR run that **FAILED**, and a link to the run that **PASSED** after you fixed it. Break a test on purpose to get the failing run. Both links go in `ANSWERS.md`, plus screenshots in case the repo goes private.

### Task 42 (3 marks) — Caching

_Put your exam token in a comment in the workflow file._

Your first pipeline run is slow because it downloads all dependencies. Cache them.

**Submit:** a screenshot of the Actions run list showing a cold run duration and a warm run duration, with the durations visible. State the improvement in `ANSWERS.md`.

### Task 43 (7 marks) — The main branch pipeline

_Put your exam token in a comment in the workflow file._

Create `.github/workflows/deploy.yml` that runs on push to `main`:

1. Build the image
2. Tag it with **both** the git SHA and a version tag, e.g. `v1.0.3`
3. Push it to a registry
4. **Do not put long-lived credentials in the repo.**

**Hard rule:** if I find `AWS_SECRET_ACCESS_KEY` or any static access key stored as a repo secret and used in a workflow, this whole section scores 0. In Scenario C you will use OIDC instead — if you get that working here too, say so, it earns credit.

Multi-arch build (`platforms: linux/amd64,linux/arm64`) is optional. If you skip it, explain in `ANSWERS.md` why you might want it.

**Submit:** the workflow file, and a screenshot of your package in the GitHub Packages tab showing multiple tags.

### Task 44 (6 marks) — Deploy automatically, with an approval gate

_Run `echo "$EXAM_TOKEN | $(date)"` on the VPS before screenshotting the deployed result._

Add a deploy job that connects to your VPS and updates the running service.

**Submit:**

- Screenshot of the workflow paused with the “Review pending deployments” button
- Screenshot after approval, showing the deploy succeeded
- Screenshot of your VPS running the new version (`docker service ps notes_app` showing the new image tag)

### Task 45 (6 marks) — Break the pipeline three ways

_Run `echo "$EXAM_TOKEN | $(date)"` in the terminal screenshot proving production survived._

Make it fail on purpose, three different ways, and show all three runs:

1. **A failing test** — change an assertion so it is wrong. Push. Show the red run.
2. **A build error** — break your Dockerfile, e.g. `COPY nonexistent-file /app/`. Push. Show the red run.
3. **A deploy failure** — make the deploy step fail, e.g. wrong service name or unreachable host. Show the red run.

**Then the important part:** after the failed deploy, prove that **production is still running the old working version**. Show `docker service ps notes_app` and a successful `curl` to your live app.

In `ANSWERS.md` explain: what in your setup made the failed deploy safe? What would have happened if you had deployed by running `docker service rm` and then recreating it?

### Task 46 (2 marks) — Add one safeguard

_Put your exam token in a comment in the workflow file._

Add one non-obvious protection to your pipeline and explain what incident it prevents. Pick one:

- **Concurrency group** — stops two deploys running at once and racing each other
- **Job timeout** — `timeout-minutes: 15` so a hung job does not run forever

In `ANSWERS.md`, describe a specific incident your chosen safeguard would have prevented.

---

# SCENARIO C — AWS and Multi-Tenancy (94 marks)

_Covers Session 6, 7, 8, 9. Kept deliberately simple — I want you to get your app running on AWS and understand the pieces._

> **Cost warning:** use free tier. `t3.micro` or `t2.micro` EC2, Fargate with minimum CPU and memory, `db.t3.micro` RDS, or just run Postgres in a container. **Delete everything when you finish** — that is Task 63 and it carries marks. Set a billing alarm at $5 before you start.

---

## C1 — IAM basics (8 marks)

### Task 47 (4 marks) — A user with limited permissions

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Create an IAM user (or role) called `exam-deployer` that can:

- Push images to ECR
- Update an ECS service
- Nothing else

Attach a policy. You may start from an AWS managed policy and narrow it down, but you must end up with a custom policy where the `Resource` field names your specific repository and service — not `"*"`.

Where you must use `"*"`, add a comment saying why.

**Submit:** the policy JSON, a screenshot of this user successfully pushing to ECR, and a screenshot of the same user being **denied** something else, e.g. `aws s3 ls` returning AccessDenied.

### Task 48 (4 marks) — Test your policies

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Use the IAM Policy Simulator in the console, or the CLI:

```bash
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:user/exam-deployer \
  --action-names ecs:UpdateService s3:DeleteBucket
```

Test 4 actions: 2 that should be allowed and 2 that should be denied. Screenshot the results.

---

## C2 — Get your app running on AWS (36 marks)

Goal: your Notes API running on ECS Fargate, reachable over the internet, deployed by your CI/CD pipeline. Keep the networking simple — use the default VPC.

### Task 49 (4 marks) — Push your image to ECR

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

**Submit:** screenshot of the image in ECR with its tag and size.

### Task 50 (8 marks) — Task definition

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Create an ECS task definition (Fargate, 256 CPU / 512 memory is enough) with:

1. Your container from ECR
2. Port mapping for 3000
3. **Logs to CloudWatch** — the `awslogs` driver with a log group
4. A container health check
5. Environment variables for the DB connection

**Submit:** the task definition JSON committed to your repo with the account ID redacted, a screenshot of the running task, and a screenshot of your app’s logs appearing in CloudWatch Logs.

### Task 51 (8 marks) — Service behind a load balancer

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

**Submit:** send repeated requests to the load balancer and show the responses coming back from **different tasks** — different container IP or hostname in the response. Screenshot the repeated requests with the differing identities visible.

### Task 52 (6 marks) — Autoscaling

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Set up **one** target-tracking scaling policy on your ECS service. Easiest metric: `ECSServiceAverageCPUUtilization` with a target of 50%, min 2 tasks, max 6.

Then **actually trigger it** — hammer the ALB with load until CPU rises and ECS adds tasks:

```bash
hey -z 5m -c 50 "http://<alb-dns>/api/search?q=abc"
```

Your unindexed search endpoint is perfect for burning CPU.

**Submit:**

- The scaling policy configuration
- A CloudWatch CPU graph showing the spike
- The ECS service “Deployments and events” tab showing the scale-out event with timestamps
- Screenshot showing the task count went from 2 to more
- Then stop the load and show it scaling back in. Note how long the scale-in took — cooldown periods are long by default.

**In `ANSWERS.md`:** how long between CPU going high and a new task actually serving traffic? Add up the CloudWatch metric delay, the alarm evaluation period, task startup, and health checks passing. Why does this mean autoscaling cannot save you from a sudden traffic spike?

### Task 53 (8 marks) — Deploy from CI/CD

_Run `echo "$EXAM_TOKEN | $(date)"` alongside your screenshots, or put the token in a workflow comment._

Extend your GitHub Actions pipeline: on push to main, build, push to ECR, and update the ECS service.

**Submit:**

- Screenshot of a successful pipeline run deploying to ECS
- Screenshot of the ECS service showing the new task definition revision
- Screenshot of your trust policy showing the repo condition

### Task 54 (2 marks) — Something is broken, debug it

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Deliberately break one thing so your ECS task fails to start or fails its health checks. Pick one:

- Wrong port in the target group, e.g. 3001 instead of 3000
- Health check path that returns 404

Then debug it and write down the exact order of checks you used. Submit that list plus screenshots of the failure state and the fixed state.

---

## C3 — S3 and file uploads (20 marks)

Your Notes API lets users attach files.

### Task 55 (5 marks) — A private bucket and a presigned upload

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

1. Create a bucket. **Block all public access** — this is the default, leave it on.
2. Add an endpoint to your API: `POST /api/attachments/upload-url` which returns a presigned PUT URL.
3. Upload with the URL:

```bash
curl -X PUT --upload-file myfile.png "<the-presigned-url>"
```

**Submit:** screenshot of the generated URL, the successful upload, and the object visible in the S3 console.

### Task 56 (4 marks) — Presigned download and expiry

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

1. Add `GET /api/attachments/:key/download-url` returning a presigned GET URL with a **60 second** expiry.
2. Open it in a browser — it works.
3. Wait 61 seconds. Open it again. Screenshot the exact XML error S3 returns.
4. Also show what happens if you try to access the object **without** a presigned URL: `curl https://bucket.s3.amazonaws.com/tenants/acme/file.png` → AccessDenied.

**In `ANSWERS.md`:** if a user copies their presigned URL and posts it in a public Telegram group, what can strangers do? For how long? Give **two different ways** to reduce that risk, and say which one you would actually implement and why.

### Task 57 (6 marks) — Two different access patterns in one bucket

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

You need two kinds of files:

- `tenants/<tenant>/private/*` — only accessible via presigned URL, never public
- `public/*` — anyone can read directly with a plain URL, no signing

**Prove all three of these, one screenshot each:**

1. Plain browser URL to a file in `public/` → works
2. Plain browser URL to a file in `tenants/acme/private/` → AccessDenied
3. Presigned URL to that same private file → works

### Task 58 (5 marks) — Tenant isolation

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Tenant `acme` must never be able to read `globex`’s files, even if they know or guess the object key.

Your presigned URLs are generated by your API, so the security check happens **in your code**, before you sign anything.

**Prove it:** as tenant `acme`, request a presigned URL for a key belonging to `globex`. Screenshot the 403.

---

## C4 — Multi-tenancy with subdomains (26 marks)

_No TLS certificates required for this section. HTTP is fine. I want you to understand the routing and the isolation, not fight with certbot._

### The goal

Each customer gets their own subdomain:

- `acme.yourdomain.com`
- `globex.yourdomain.com`

Both hit **the same running application**. The app looks at the `Host` header, works out which tenant it is, and only shows that tenant’s data.

A customer can also bring their own domain: `notes.customercompany.com` should also work.

You need a real domain for this. A cheap `.xyz`, or a free subdomain from DuckDNS or nip.io, works. If you cannot get a domain at all you may simulate it with `/etc/hosts` entries on your laptop — but say so clearly, and you lose 3 marks.

### Task 59 (8 marks) — Wildcard DNS and Host-based routing

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

**Prove it:**

- `curl http://acme.yourdomain.com/api/notes` returns acme’s notes
- `curl http://globex.yourdomain.com/api/notes` returns different notes
- `curl http://doesnotexist.yourdomain.com/api/notes` returns a clean 404, not a crash
- Show `docker ps` or `systemctl status` proving there is only **one** app instance serving all of them

### Task 60 (7 marks) — Automatic tenant provisioning

_Run `echo "$EXAM_TOKEN | $(date)"` in the same terminal as the provisioning commands._

Right now, adding a tenant means editing the database by hand. Automate it.

Build `POST /api/tenants` that takes `{"slug": "newcorp", "name": "New Corp"}` and:

1. Inserts the tenant row
2. Creates whatever per-tenant setup you need — an S3 folder, seed data, whatever
3. Returns the tenant’s URL

Because you have wildcard DNS and a regex server block, **no DNS change and no nginx change is needed** — the subdomain works instantly. That is the whole point of this design.

**Prove it in one terminal session:**

```bash
echo "$EXAM_TOKEN |$(date)"
curl -X POST http://yourdomain.com/api/tenants \
  -H 'Content-Type: application/json' \
  -d '{"slug":"newcorp","name":"New Corp"}'
curl http://newcorp.yourdomain.com/api/notes
```

Screenshot all of it in one terminal.

**In `ANSWERS.md`:**

- Why did you not need to touch nginx or DNS?
- What validation does the `slug` field need? What if someone creates a tenant called `www`, `api`, or `admin`, or a slug with a dot in it? Implement at least a blocklist of reserved names and show it rejecting one.

### Task 61 (6 marks) — Custom domain (bring your own domain)

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

A customer wants `notes.theircompany.com` instead of `theircompany.yourdomain.com`.

**Prove it.** Use a second real domain if you have one.

**State clearly which one you did.** A real second domain scores full marks.

### Task 62 (5 marks) — What can go wrong

_Before every screenshot in this task, run `echo "$EXAM_TOKEN | $(date)"` in the same terminal._

Answer these in `ANSWERS.md`. Where you can demonstrate it, do — a screenshot doubles the marks for that point.

1. **A customer points their DNS at you before verifying.** What does a visitor to their domain see right now? Is that acceptable? Fix it so unknown domains get a proper “domain not configured” page instead of an error or, worse, another tenant’s data.
2. **Two tenants both claim `notes.example.com`.** What stops the second one? Show your database constraint or application check, and show the error the second tenant gets.
3. **The tenant header can be faked.** Right now, what stops someone sending `curl -H "X-Tenant: globex" http://acme.yourdomain.com/api/notes` and reading globex’s data? Test it. If it works, that is a real vulnerability — fix it (hint: nginx should always overwrite the header, never pass through a client-supplied one) and show it fixed.
4. **Find one more isolation bug in your own code.** Every multi-tenant app has them. Look for a query missing its `WHERE tenant_id`, a cache key that does not include the tenant, an ID lookup like `GET /api/notes/:id` that fetches by ID without checking the tenant owns it, or log lines leaking one tenant’s data into another’s view.

---

## C5 — Clean up (4 marks)

### Task 63

_Run `echo "$EXAM_TOKEN | $(date)"` before the cleanup screenshots._

Delete everything you created: ECS service and cluster, ALB, target groups, ECR images, S3 bucket contents and the bucket, RDS if you made one, secrets, IAM roles you no longer need, EC2 instances.

**Submit:**

- Output of a resource listing showing nothing left:
  ```bash
  aws ecs list-clusters
  aws elbv2 describe-load-balancers
  aws s3 ls
  aws ec2 describe-instances \
    --query 'Reservations[].Instances[?State.Name!=`terminated`].InstanceId'
  ```
- A screenshot of your AWS Billing or Cost Explorer page

If you leave something running you will be paying for it, not me — but you also lose these marks.

---

# MARK BREAKDOWN

| Section                                      | Tasks | Marks   |
| -------------------------------------------- | ----- | ------- |
| **SCENARIO A — Inherited Server**            |       | **82**  |
| A1 access model                              | 1–4   | 20      |
| A2 port investigation                        | 5–8   | 12      |
| A3 bash script                               | 9–11  | 12      |
| A4 systemd                                   | 12–15 | 22      |
| A5 nginx                                     | 16–20 | 16      |
| **SCENARIO B — Containerize, Ship, Observe** |       | **124** |
| B1 image build                               | 21–25 | 18      |
| B2 compose + debugging                       | 26–28 | 18      |
| B3 Prometheus + Grafana                      | 29–34 | 32      |
| B4 Swarm                                     | 35–40 | 26      |
| B5 CI/CD                                     | 41–46 | 30      |
| **SCENARIO C — AWS + Multi-Tenancy**         |       | **94**  |
| C1 IAM                                       | 47–48 | 8       |
| C2 ECS deployment                            | 49–54 | 36      |
| C3 S3                                        | 55–58 | 20      |
| C4 multi-tenancy                             | 59–62 | 26      |
| C5 cleanup                                   | 63    | 4       |
| **TOTAL**                                    |       | **300** |
| **AI_PROMPTS.md bonus**                      |       | **+10** |

**Deductions:** Screenshots without your exam token: zero for that task.

Good luck.
