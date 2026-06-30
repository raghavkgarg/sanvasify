#!/bin/bash

# sync_dbv2.sh - Restructured and cleaned database synchronization script

# 1. Initialization and Configuration
# ---------------------------------------------------------
set -e

# Prevent sleep while this script is running
caffeinate -dimsu -w $$ & 

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure common paths are included
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export TZ='Asia/Kolkata'

# Constants
KEY_FILE="$PROJECT_ROOT/sn1.pem"
LOCAL_DB="/Users/raghavgarg/Projects/duckdb/sanvasify/sanvasify.db"
REMOTE_DATA_DIR="/opt/sanvasify/data"
INSTANCE_NAME="sanvasify-prod"
NOTIFICATION_RECIPIENT="raghavk.garg@icloud.com"

# Colors
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; NC=''
fi

# SSH Options
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=10 -o IPQoS=throughput -o ConnectTimeout=15"

# 2. Utility Functions
# ---------------------------------------------------------
log_info()    { echo -e "${GREEN}>>> [INFO] $1${NC}"; }
log_warn()    { echo -e "${YELLOW}>>> [WARN] $1${NC}"; }
log_error()   { echo -e "${RED}>>> [ERROR] $1${NC}"; }
die()         { log_error "$1"; exit 1; }

check_power() {
    log_info "2. Performing power check..."
    BATT_INFO=$(pmset -g batt)
    if [[ "$BATT_INFO" == *"Battery Power"* ]]; then
        BATT_PCT=$(echo "$BATT_INFO" | grep -o "[0-9]\{1,3\}%" | tr -d '%')
        log_info "2.1  Battery is at ${BATT_PCT}%"
        if [ "$BATT_PCT" -lt 30 ]; then
            local msg="Sanvasify Mac Alert: Battery is at ${BATT_PCT}%. Please connect to power."
            log_warn " 2.3 $msg..."
            osascript -e "display notification \"$msg\" with title \"Sanvasify Sync Alert\""
            osascript -e "tell application \"Messages\" to send \"$msg\" to buddy \"$NOTIFICATION_RECIPIENT\"" &>/dev/null || true
            [ "$BATT_PCT" -lt 20 ] && die "2.4 Critical battery level (${BATT_PCT}%). Aborting."
        fi
    else
        log_info "2.1 Connected to AC power."
    fi
}

stop_local_server() {
    log_info "3. Checking for local server..."
    if pgrep -f "dist/sanvasify" > /dev/null; then
        log_warn "3.1 Stopping local server to unlock database..."
        pkill -f "dist/sanvasify" || true
    else
        log_info "3.1 No local server process found."
    fi
}

run_local_fetcher() {
    log_info "4. Building and running Fetcher..."
    go build -o dist/fetch ./cmd/fetch
    
    set +e
    ./dist/fetch
    local fetch_status=$?
    set -e
    
    if [ "$fetch_status" -eq 0 ]; then
        log_info "4.1 Fetcher completed successfully at $(date '+%Y-%m-%d %H:%M:%S')"
    elif [ "$fetch_status" -eq 2 ]; then
        log_info "4.2 Data is already up to date. Exiting gracefully."
        exit 0
    elif [ "$fetch_status" -ne 0 ]; then
        die "4.3 Fetcher failed with exit code $fetch_status"
    fi

}

run_local_loader () {

    log_info "5. Building and running Loader..."
    go build -o dist/load ./cmd/load
    ./dist/load || die "5.1 Loader failed to update the local database."
    log_info "5.2 Loader completed successfully at $(date '+%Y-%m-%d %H:%M:%S')"

}

resolve_remote_host() {
    log_info "6. Resolving AWS instance IP for '$INSTANCE_NAME'..."
    local ipv4=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].PublicIpAddress" --output text 2>/dev/null)
    local ipv6=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].NetworkInterfaces[0].Ipv6Addresses[0].Ipv6Address" --output text 2>/dev/null)

    if [ -n "$ipv4" ] && [ "$ipv4" != "None" ]; then
        REMOTE_IP="$ipv4"
        SCP_DEST="ec2-user@$ipv4"
    elif [ -n "$ipv6" ] && [ "$ipv6" != "None" ]; then
        REMOTE_IP="$ipv6"
        SCP_DEST="ec2-user@[$ipv6]"
    else
        die "Could not resolve a public IP. Ensure the instance is running and tagged correctly."
    fi
    REMOTE_USER_HOST="ec2-user@$REMOTE_IP"
    log_info "6.1 Host resolved to: $REMOTE_IP"
}

upload_database() {
    log_info "7. Uploading database to staging area..."
    local max_retries=3
    local count=0
    until scp $SSH_OPTS -i "$KEY_FILE" "$LOCAL_DB" "$SCP_DEST:~/"; do
        count=$((count + 1))
        if [ $count -ge $max_retries ]; then
            die "SCP upload failed after $max_retries attempts."
        fi
        log_warn "SCP failed. Retrying ($count/$max_retries) in 5s..."
        sleep 5
    done
    log_info "7.1 Database uploaded to staging area successfully."
}

remote_deploy() {
    log_info "8. Executing remote deployment on $REMOTE_IP..."
    ssh $SSH_OPTS -i "$KEY_FILE" "$REMOTE_USER_HOST" "REMOTE_DATA_DIR='$REMOTE_DATA_DIR' bash" << 'EOF'
set -e

if [ -z "$REMOTE_DATA_DIR" ] || [ "$REMOTE_DATA_DIR" == "/" ] || [ "$REMOTE_DATA_DIR" == "/home" ]; then
    echo ">>> [REMOTE] Error: REMOTE_DATA_DIR is empty or invalid ($REMOTE_DATA_DIR). Aborting."
    exit 1
fi

echo ">>> [REMOTE] 8.1 Verifying staged database..."
[ -f ~/sanvasify.db ] || { echo ">>> [REMOTE] Error: Database not found in staging! Aborting deployment to keep current services active."; exit 1; }

echo ">>> [REMOTE] 8.2 Stopping services..."
sudo systemctl stop sanvasify caddy

echo ">>> [REMOTE] 8.3 Moving database to $REMOTE_DATA_DIR..."
sudo mv ~/sanvasify.db "$REMOTE_DATA_DIR/"
sudo rm -f "$REMOTE_DATA_DIR/sanvasify.db.wal"

echo ">>> [REMOTE] 8.4 Applying permissions..."
sudo chown -R sanvasify:sanvasify "$REMOTE_DATA_DIR/"
sudo chmod 750 "$REMOTE_DATA_DIR/"

echo ">>> [REMOTE] 8.5 Restarting services..."
sudo systemctl daemon-reload
sudo systemctl start sanvasify caddy
echo ">>> [REMOTE] 8.6 Status: $(sudo systemctl is-active sanvasify)"
EOF
}

# 3. Main Execution
# ---------------------------------------------------------
log_info ">*>.>*>.>*>.>*>.>*>.>*>.>*>.>*>.>*>.>*>."
log_info "1. Starting Database Sync Workflow v2"
cd "$PROJECT_ROOT"

check_power
stop_local_server
run_local_fetcher
run_local_loader
resolve_remote_host
upload_database
remote_deploy

log_info "9. Database Sync completed successfully at $(date '+%Y-%m-%d %H:%M:%S')."
log_info ">*>.>*>.>*>.>*>.>*>.>*>.>*>.>*>.>*>.>*>."