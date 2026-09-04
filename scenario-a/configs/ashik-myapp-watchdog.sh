#!/bin/bash
curl -sf --max-time 5 http://127.0.0.1:3500/healthz || systemctl restart ashik-myapp
