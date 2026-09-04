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

### Task 15 — Why `Restart=on-failure` didn't catch the hang

`Restart=on-failure` only reacts when the process actually exits with a non-zero code. Hitting `/hang` leaves the Node process alive and still listening — it just stops replying to any request — so from systemd's point of view the process never failed, and `Restart=on-failure` has nothing to trigger on. Catching this needed an active check from outside the process (the watchdog timer hitting `/healthz` every 30s and killing/restarting on timeout), not a passive exit-code watcher. Proof: watchdog logged `OK` at 13:45:17, `/hang` was hit at 13:45:30, the next watchdog run at 13:45:47 timed out (no `OK`) and triggered `systemctl restart` — `ashik-myapp.service` shows Stopped/Started at the same second, 13:45:53, and `/healthz` returned `OK` again right after.
