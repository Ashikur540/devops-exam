#!/bin/bash

CONFIG="${1:-./checks.conf}"
LOG_FILE="/var/log/healthcheck.log"
LOCK_FILE="/tmp/ashik-healthcheck.lock"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [[ ! -r "$CONFIG" ]]; then
    echo "Config file missing or unreadable: $CONFIG"
    exit 2
fi

if ! mkdir "$LOCK_FILE" 2>/dev/null; then
    exit 0
fi

trap 'rmdir "$LOCK_FILE"' EXIT

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

FAILED=0

while IFS='|' read -r name url expected; do
    [[ -z "$name" ]] && continue
    [[ "$name" =~ ^# ]] && continue

    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$url")

    if [[ "$code" == "$expected" ]]; then
        echo -e "${GREEN}OK${NC}   $name ($code)"
        log "OK   $name url=$url expected=$expected actual=$code"
    else
        echo -e "${RED}FAIL${NC} $name (expected $expected, got $code)"
        log "FAIL $name url=$url expected=$expected actual=$code"
        FAILED=1
    fi
done < "$CONFIG"

disk=$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')

if (( disk > 80 )); then
    echo -e "${YELLOW}WARNING${NC} Disk usage on / is ${disk}%"
    log "WARNING Disk usage on / is ${disk}%"
else
    echo "Disk usage on / is ${disk}%"
    log "Disk usage on / is ${disk}%"
fi

exit "$FAILED"
