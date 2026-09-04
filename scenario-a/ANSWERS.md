### Task 3 Explanation

Deleting a file in Linux is controlled mainly by the parent directory's permissions, not by the file's own permissions. Since Carol owns the `backups` directory, the sticky bit alone could not stop her from deleting files.

To satisfy the requirement, the backup files were marked as **immutable** using `chattr +i`. This prevents modification or deletion of the backup files until the immutable flag is removed by root.

### Task 6 - Explanation:

ss -lptn and lsof -i :8080 were used to identify the process listening on port 8080. When run with sudo, both commands were able to display the complete process information, including the PID, user, and program name.

Without sudo, a normal user may not be able to see process information belonging to another user, especially a root-owned process. In this case, the process listening on port 8080 is owned by root, so elevated privileges are required to inspect its complete process details.

This happens because Linux restricts access to process information for security and privacy reasons. sudo provides the necessary privileges to inspect processes owned by other users.

### Task 7 - Explanation:

The process listening on port 8080 was started manually from a shell, as shown by the process tree `bash → sudo → python3`. It was not managed by systemd or cron. Therefore, the proper way to stop it was to press `Ctrl+C` in the terminal where the server was running.

If the process had been managed by systemd, using `kill -9 PID` would terminate the process immediately, but systemd could start it again if the service had a restart policy such as `Restart=always`. The correct approach for a systemd-managed process is to stop or restart it through `systemctl` so that the service manager is aware of the state.

After pressing `Ctrl+C`, `ss -lptn 'sport = :8080'` showed no listening process, confirming that port 8080 was free.

### Task 8 - Explanation:

The application was started on port 8080 and was successfully accessed from the server using `curl http://localhost:8080`, which returned the HTTP directory listing.

However, accessing the server through its public IP address resulted in `Connection refused`. The application was bound to `127.0.0.1`, which means it was listening only on the server's loopback interface and was not accepting connections through the public network interface.

A connection timeout generally means that the connection attempt receives no response, often because traffic is being dropped by a firewall or network security rule. In contrast, `Connection refused` means the host is reachable but the connection was actively rejected, commonly because no service is listening on that address and port or an active rule is rejecting the connection.

### Task 10 — Break it on purpose

1. Pointed the script at a non-existent config file (`does-not-exist.conf`) → exited with code 2, no crash, matches spec.
2. Added an unresolvable URL (`bad|http://doesnotexist.invalid/|200`) to a copy of `checks.conf` and re-ran with `time`. Script did not hang — finished in ~1.3s (well under the 3s curl `--max-time`), reported it as a normal FAIL (`got 000`), and continued checking the remaining services. No code changes were needed — `curl --max-time 3` already handles this case.

### Task 13 — Why limit the restarts in production

Without a limit, systemd would restart a crash-looping app forever — burning CPU, filling logs, and hiding a real bug because the service always looks "up" a second later. Marking it `failed` after 5 crashes in 60s stops the noise and forces someone to actually notice and investigate, instead of the process silently flapping in the background indefinitely.

With `Restart=always` and no start limit removed, the same 6-crash test left the service `active (running)` the entire time (restart counter reached 6, no `failed` state ever appeared). In production, `systemctl status` alone would never reveal this — I would need an alert on the restart count / crash rate itself (e.g. a metric on process restarts, or watching journalctl for repeated `Main process exited`/`Scheduled restart job` lines), not just on whether the service is currently "down".

### Task 17 — Load balancing algorithms

Round-robin (default): 51 / 49 split across the two backends — near-even, as expected for strict alternation.

`least_conn`: 52 / 48 — almost identical to round-robin. This is expected with our test: `curl` requests are sent one at a time and each finishes almost instantly, so at any given moment both backends have 0-1 active connections — `least_conn` has nothing meaningful to differentiate on. Its real advantage shows up with concurrent or slow requests (e.g. many clients hitting `/slow` at once) — round-robin would keep sending new traffic to a backend that's still busy, while `least_conn` would route around it.

### Task 18 — Health checks and failover

Config had no explicit `max_fails`/`fail_timeout` at this point, so nginx used its built-in defaults: `max_fails=1`, `fail_timeout=10s`.

- Backend 3501 was stopped at 16:42:25. Last successful response from it was 16:42:27; from 16:42:28 onward only 3500 responded.
- **Zero requests visibly failed** — no `FAILED`/502 ever appeared in the client loop. This is because nginx's default `proxy_next_upstream` automatically retries a failed connection on the other backend within the same client request, so the failover is invisible to the client — it only took 1 failed attempt (`max_fails=1`) to mark 3501 down.
- Backend 3501 was restarted at 16:42:41. Traffic returned to it at 16:42:51 — **~10 seconds after the restart**, matching `fail_timeout=10s`: nginx only retries a downed backend once per `fail_timeout` window, so even though the process was back up immediately, nginx didn't notice until its next scheduled retry.

**With `max_fails=1`, `fail_timeout=30s` explicitly set:** backend stopped at 16:47:12, restarted at 16:49:52, traffic returned at 16:49:55 — only ~3 seconds after restart this time, faster than the 10s run. This isn't a contradiction: `fail_timeout` sets nginx's retry *cadence* (how often it re-checks a downed backend), not a fixed recovery delay. With a longer downtime window (this backend was down ~2.5 minutes vs ~16 seconds before) there are more retry cycles, and it comes down to whether the actual process restart happens to land just before or just after one of those scheduled retries — recovery time is anywhere from ~0 to `fail_timeout` seconds after the real restart, and 30s just widens that worst case (up to 30s of stale-down state) compared to 10s. In production this is the real tradeoff: a longer `fail_timeout` means fewer wasted probes against a genuinely dead backend, but a longer worst-case window before a recovered backend gets traffic back.

### Task 19 — Why raising the timeout is the wrong fix

Raising `proxy_read_timeout` just makes nginx *wait longer* for the same slow work — it doesn't make the work faster. Each request to `/slow` still ties up one nginx worker connection and one backend Node process for the full duration. If 500 users hit `/slow` at once, nginx would hold 500 open upstream connections for 45 seconds each instead of failing fast; worker connections and backend capacity get exhausted, and *every other* request (including fast ones like `/healthz`) queues up behind them or gets refused — one slow endpoint takes down the whole service.

What I'd actually do in production: make `/slow` asynchronous — accept the request, return immediately with a job ID (202 Accepted), do the 45s work in a background job/queue, and let the client poll or get notified when it's done. If it truly must be synchronous, it needs its own isolated worker pool / connection limit so it can't starve the rest of the app, plus a sane timeout on the client side too so nobody waits 45s for nothing.

Also found while testing: my `location /slow` retried the timeout on the *second* backend too by default (`proxy_next_upstream`), doubling the wait to 10s before nginx even sent the 504 — fixed with `proxy_next_upstream off;` for this location, since retrying a timeout on another backend just wastes that backend's capacity on a request the client will time out on anyway.

### Task 15 — Why `Restart=on-failure` didn't catch the hang

`Restart=on-failure` only reacts when the process actually exits with a non-zero code. Hitting `/hang` leaves the Node process alive and still listening — it just stops replying to any request — so from systemd's point of view the process never failed, and `Restart=on-failure` has nothing to trigger on. Catching this needed an active check from outside the process (the watchdog timer hitting `/healthz` every 30s and killing/restarting on timeout), not a passive exit-code watcher. Proof: watchdog logged `OK` at 13:45:17, `/hang` was hit at 13:45:30, the next watchdog run at 13:45:47 timed out (no `OK`) and triggered `systemctl restart` — `ashik-myapp.service` shows Stopped/Started at the same second, 13:45:53, and `/healthz` returned `OK` again right after.
