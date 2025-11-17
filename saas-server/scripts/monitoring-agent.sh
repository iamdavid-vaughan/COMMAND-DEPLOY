#!/bin/bash
#
# Focal Deploy Monitoring Agent
# Collects server metrics and reports to API
#
# This script is installed on each deployment server and runs via systemd
# Reports metrics every 30 seconds for real-time dashboard

# Configuration (set during installation)
API_URL="${FOCAL_API_URL:-https://api.focuswithfocal.com}"
DEPLOYMENT_ID="${FOCAL_DEPLOYMENT_ID}"
AUTH_TOKEN="${FOCAL_MONITOR_TOKEN}"
INTERVAL="${FOCAL_MONITOR_INTERVAL:-30}" # Seconds between reports

# ==========================================
# Helper Functions
# ==========================================

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

get_cpu_percent() {
  # Get CPU usage percentage
  top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}'
}

get_ram_stats() {
  # Get RAM usage in MB and percentage
  free -m | awk 'NR==2{printf "{\"used\":%s,\"total\":%s,\"percent\":%.2f}", $3,$2,$3*100/$2 }'
}

get_disk_stats() {
  # Get disk usage for root partition
  df -BG / | awk 'NR==2{gsub(/G/,"",$3); gsub(/G/,"",$2); printf "{\"used\":%s,\"total\":%s,\"percent\":%s}", $3,$2,$5}' | sed 's/%//'
}

get_network_stats() {
  # Get network RX/TX in MB
  INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
  if [ -n "$INTERFACE" ]; then
    cat /proc/net/dev | grep "$INTERFACE" | awk '{printf "{\"rx_mb\":%.2f,\"tx_mb\":%.2f}", $2/1048576, $10/1048576}'
  else
    echo '{"rx_mb":0,"tx_mb":0}'
  fi
}

get_load_average() {
  # Get system load average
  uptime | awk -F'load average:' '{print $2}' | awk '{printf "{\"1min\":%s,\"5min\":%s,\"15min\":%s}", $1,$2,$3}' | sed 's/,"/"/g'
}

get_app_status() {
  # Check if app is running via PM2
  if command -v pm2 &> /dev/null; then
    ONLINE_COUNT=$(pm2 jlist 2>/dev/null | jq '[.[] | select(.pm2_env.status=="online")] | length' 2>/dev/null || echo 0)
    if [ "$ONLINE_COUNT" -gt 0 ]; then
      echo "online"
    else
      echo "offline"
    fi
  else
    echo "unknown"
  fi
}

get_app_uptime() {
  # Get app uptime from PM2
  if command -v pm2 &> /dev/null; then
    PM2_UPTIME=$(pm2 jlist 2>/dev/null | jq -r '.[0].pm2_env.pm_uptime' 2>/dev/null)
    if [ -n "$PM2_UPTIME" ] && [ "$PM2_UPTIME" != "null" ]; then
      # Convert milliseconds to human readable
      UPTIME_SEC=$((PM2_UPTIME / 1000))
      uptime -p | sed 's/up //'
    else
      echo "N/A"
    fi
  else
    uptime -p | sed 's/up //'
  fi
}

get_app_memory() {
  # Get app memory usage from PM2 (in MB)
  if command -v pm2 &> /dev/null; then
    pm2 jlist 2>/dev/null | jq '[.[] | .monit.memory] | add // 0' 2>/dev/null | awk '{print int($1/1048576)}' || echo 0
  else
    echo 0
  fi
}

get_process_count() {
  ps aux | wc -l
}

# ==========================================
# Main Monitoring Function
# ==========================================

collect_metrics() {
  # Collect all metrics
  CPU=$(get_cpu_percent)
  RAM=$(get_ram_stats)
  DISK=$(get_disk_stats)
  NETWORK=$(get_network_stats)
  LOAD=$(get_load_average)
  APP_STATUS=$(get_app_status)
  APP_UPTIME=$(get_app_uptime)
  APP_MEMORY=$(get_app_memory)
  PROCESS_COUNT=$(get_process_count)

  # Build JSON payload
  JSON_PAYLOAD=$(cat <<EOF
{
  "deploymentId": "$DEPLOYMENT_ID",
  "cpu_percent": $CPU,
  "ram": $RAM,
  "disk": $DISK,
  "network": $NETWORK,
  "loadAvg": $LOAD,
  "app_status": "$APP_STATUS",
  "app_uptime": "$APP_UPTIME",
  "app_memory_mb": $APP_MEMORY,
  "process_count": $PROCESS_COUNT
}
EOF
)

  echo "$JSON_PAYLOAD"
}

send_metrics() {
  PAYLOAD=$(collect_metrics)

  # Send to API
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/monitoring/report" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    log "✓ Metrics sent successfully"
    return 0
  else
    log "✗ Failed to send metrics (HTTP $HTTP_CODE): $BODY"
    return 1
  fi
}

# ==========================================
# Main Loop
# ==========================================

main() {
  log "🚀 Focal Deploy Monitoring Agent started"
  log "   Deployment ID: $DEPLOYMENT_ID"
  log "   API URL: $API_URL"
  log "   Report Interval: ${INTERVAL}s"

  # Initial health check
  log "Performing initial health check..."
  if ! send_metrics; then
    log "⚠️  Initial health check failed, but continuing anyway..."
  fi

  # Main monitoring loop
  while true; do
    sleep "$INTERVAL"

    # Collect and send metrics
    if ! send_metrics; then
      log "⚠️  Metric submission failed, will retry in ${INTERVAL}s"
    fi
  done
}

# ==========================================
# Entry Point
# ==========================================

# Validate required environment variables
if [ -z "$DEPLOYMENT_ID" ]; then
  log "❌ ERROR: FOCAL_DEPLOYMENT_ID not set"
  exit 1
fi

if [ -z "$AUTH_TOKEN" ]; then
  log "❌ ERROR: FOCAL_MONITOR_TOKEN not set"
  exit 1
fi

# Install dependencies if needed
if ! command -v jq &> /dev/null; then
  log "Installing jq..."
  apt-get update -qq && apt-get install -y jq >/dev/null 2>&1
fi

# Run main loop
main
