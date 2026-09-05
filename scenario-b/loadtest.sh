#!/bin/bash
# loadtest.sh — Task 31 load generator for the Notes API.
# Usage: ./loadtest.sh [base_url]
# Runs >=5 minutes, hits all endpoints, uses 5 tenants, makes one tenant
# ("acme") deliberately heavier (?limit=5000), and fires a 30s burst
# midway through so the dashboard has a visible spike.

set -u
BASE=${1:-http://localhost:8300}
TENANTS=(acme globex initech umbrella soylent)
HEAVY_TENANT=acme
DURATION=${DURATION:-300}

hit_one_round() {
  local t=$1
  curl -s -o /dev/null --max-time 10 -H "X-Tenant:$t" "$BASE/api/notes?limit=20" &
  curl -s -o /dev/null --max-time 10 -H "X-Tenant:$t" "$BASE/api/search?q=abc" &
  curl -s -o /dev/null --max-time 10 -H "X-Tenant:$t" "$BASE/api/stats" &
  curl -s -o /dev/null --max-time 10 -H "X-Tenant:$t" "$BASE/api/notes/1" &
  if [ "$t" == "$HEAVY_TENANT" ]; then
    curl -s -o /dev/null --max-time 10 -H "X-Tenant:$t" "$BASE/api/notes?limit=5000" &
  fi
}

baseline() {
  local end=$((SECONDS + DURATION))
  local rounds=0
  while [ $SECONDS -lt $end ]; do
    t=${TENANTS[$RANDOM % ${#TENANTS[@]}]}
    hit_one_round "$t"
    rounds=$((rounds + 1))
    sleep 0.2
  done
  wait
  echo "[baseline] done: $rounds rounds over ${DURATION}s"
}

burst() {
  echo "[burst] starting heavy concurrent load for 30s..."
  local end=$((SECONDS + 30))
  local hits=0
  while [ $SECONDS -lt $end ]; do
    for t in "${TENANTS[@]}"; do
      for i in 1 2 3; do
        curl -s -o /dev/null --max-time 10 -H "X-Tenant:$t" "$BASE/api/notes?limit=20" &
        hits=$((hits + 1))
      done
    done
    sleep 0.3
  done
  wait
  echo "[burst] done: ~$hits requests fired in 30s"
}

echo "Load test starting: ${DURATION}s baseline, tenants=${TENANTS[*]}, heavy tenant=$HEAVY_TENANT"
baseline &
BASELINE_PID=$!

sleep $((DURATION / 2))
burst

wait "$BASELINE_PID"
echo "Load test complete."
