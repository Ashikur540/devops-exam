# AI Prompts Log

Bonus: 10 marks. Minimum 8 entries for full marks. Log every time AI genuinely
helped — what you were stuck on, the exact prompt, whether it worked, what you
had to change to make it work on *your* machine. Pasting a prompt with no
"what went wrong" note only earns 2 marks — the gap between the generic
answer and your real problem is what's graded.

Copy this block per entry:

```
## [Short title of the problem]

**Stuck on:**

**Prompt:**


**Answer:**


**What actually fixed it:**

```

---

## Example (from the exam spec, for reference — delete once you have real entries)

**Stuck on:** nginx returning 502 after adding my second backend.

**Prompt:** "nginx reverse proxy returns 502 bad gateway, backend is running on
port 3001 and curl localhost:3001 works from the server. here is my config:
[pasted config]"

**Answer:** It told me to check `proxy_pass` and SELinux. SELinux was not the
issue on Ubuntu.

**What actually fixed it:** My upstream block said `server localhost:3001;`
and nginx resolved `localhost` to `::1` (IPv6), but my app only listened on
IPv4. Changed it to `127.0.0.1:3001`. AI did not catch this — found it with
`ss -lntp`.
