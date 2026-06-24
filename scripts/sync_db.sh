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
export PATH="$HOME/.duckdb/cli/latest:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
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


check_local_power() {
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
    log_info "5.1 Updating local sanvasify.db..."
    ./dist/load -db "/Users/raghavgarg/Projects/duckdb/sanvasify/sanvasify.db" || die "5.1.1 Loader failed to update local sanvasify.db."
    log_info "5.2 Updating local sanvas.db..."
    ./dist/load -db "/Users/raghavgarg/Projects/duckdb/sanvasify/sanvas.db" || die "5.2.1 Loader failed to update local sanvas.db."
    log_info "5.3 Loader completed successfully at $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "5.4. Building and running Fetch Indices..."
    go build -o dist/fetch_indices ./cmd/fetch_indices/main.go
    ./dist/fetch_indices -db "/Users/raghavgarg/Projects/duckdb/sanvasify/sanvas.db"
    log_info "5.5 Fetch Indices completed successfully at $(date '+%Y-%m-%d %H:%M:%S')"

}

# Remote Execution Helpers (serialized and run on the remote AWS host)
remote_stop_services() {
    echo ">>> [REMOTE] Stopping services..."
    sudo systemctl stop sanvasify caddy
}

remote_apply_permissions() {
    local target_dir="$1"
    echo ">>> [REMOTE] Applying permissions on $target_dir..."
    sudo chown -R sanvasify:sanvasify "$target_dir/"
    sudo chmod 750 "$target_dir/"
}

remote_restart_services() {
    echo ">>> [REMOTE] Restarting services..."
    sudo systemctl daemon-reload
    sudo systemctl start sanvasify caddy
    echo ">>> [REMOTE] Status: $(sudo systemctl is-active sanvasify)"
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

upload_sanvasify() {
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

remote_deploy_sanvasify_task() {
    set -e

    if [ -z "$REMOTE_DATA_DIR" ] || [ "$REMOTE_DATA_DIR" == "/" ] || [ "$REMOTE_DATA_DIR" == "/home" ]; then
        echo ">>> [REMOTE] Error: REMOTE_DATA_DIR is empty or invalid ($REMOTE_DATA_DIR). Aborting."
        exit 1
    fi

    echo ">>> [REMOTE] 8.1 Verifying staged database..."
    [ -f ~/sanvasify.db ] || { echo ">>> [REMOTE] Error: Database not found in staging! Aborting deployment to keep current services active."; exit 1; }

    echo ">>> [REMOTE] 8.2 Stopping services..."
    remote_stop_services

    echo ">>> [REMOTE] 8.3 Moving database to $REMOTE_DATA_DIR..."
    sudo mv ~/sanvasify.db "$REMOTE_DATA_DIR/"
    sudo rm -f "$REMOTE_DATA_DIR/sanvasify.db.wal"

    echo ">>> [REMOTE] 8.4 Applying permissions..."
    remote_apply_permissions "$REMOTE_DATA_DIR"

    echo ">>> [REMOTE] 8.5 Restarting services..."
    remote_restart_services
}

deploy_sanvasify() {
    log_info "8. Executing remote deployment on $REMOTE_IP..."
    ssh $SSH_OPTS -i "$KEY_FILE" "$REMOTE_USER_HOST" "REMOTE_DATA_DIR='$REMOTE_DATA_DIR' bash" << EOF
$(declare -f remote_stop_services remote_apply_permissions remote_restart_services remote_deploy_sanvasify_task)
remote_deploy_sanvasify_task
EOF
}


update_sanvas() {
    log_info "Running update_sanvas table merge..."
    
    # 1. Local Export of sif_schemes and sif_indices to Parquet
    local local_db_sanvas="/Users/raghavgarg/Projects/duckdb/sanvasify/sanvas.db"
    log_info "Exporting local sif_schemes table to Parquet from $local_db_sanvas..."
    duckdb "$local_db_sanvas" -c "COPY (SELECT * FROM sif_schemes) TO 'data/sif_schemes.parquet' (FORMAT 'PARQUET', COMPRESSION 'ZSTD');"
    log_info "Exporting local sif_indices table to Parquet from $local_db_sanvas..."
    duckdb "$local_db_sanvas" -c "COPY (SELECT * FROM sif_indices) TO 'data/sif_indices.parquet' (FORMAT 'PARQUET', COMPRESSION 'ZSTD');"

    # 2. Upload Parquet files to staging area
    log_info "Uploading sif_schemes Parquet file to AWS..."
    local max_retries=3
    local count=0
    until scp $SSH_OPTS -i "$KEY_FILE" "data/sif_schemes.parquet" "$SCP_DEST:~/"; do
        count=$((count + 1))
        if [ $count -ge $max_retries ]; then
            rm -f "data/sif_schemes.parquet"
            rm -f "data/sif_indices.parquet"
            die "SCP upload of sif_schemes Parquet failed after $max_retries attempts."
        fi
        log_warn "SCP failed. Retrying ($count/$max_retries) in 5s..."
        sleep 5
    done
    rm -f "data/sif_schemes.parquet"

    log_info "Uploading sif_indices Parquet file to AWS..."
    count=0
    until scp $SSH_OPTS -i "$KEY_FILE" "data/sif_indices.parquet" "$SCP_DEST:~/"; do
        count=$((count + 1))
        if [ $count -ge $max_retries ]; then
            rm -f "data/sif_indices.parquet"
            die "SCP upload of sif_indices Parquet failed after $max_retries attempts."
        fi
        log_warn "SCP failed. Retrying ($count/$max_retries) in 5s..."
        sleep 5
    done
    rm -f "data/sif_indices.parquet"

    log_info "update_sanvas local export & upload completed successfully."
}

remote_deploy_sanvas_task() {
    set -e

    if [ -z "$REMOTE_DATA_DIR" ] || [ "$REMOTE_DATA_DIR" == "/" ] || [ "$REMOTE_DATA_DIR" == "/home" ]; then
        echo ">>> [REMOTE] Error: REMOTE_DATA_DIR is empty or invalid ($REMOTE_DATA_DIR). Aborting."
        exit 1
    fi

    echo ">>> [REMOTE] 20.1 Verifying staged Parquet files..."
    [ -f ~/sif_schemes.parquet ] || { echo ">>> [REMOTE] Error: Schemes Parquet file not found in staging! Aborting."; exit 1; }
    [ -f ~/sif_indices.parquet ] || { echo ">>> [REMOTE] Error: Indices Parquet file not found in staging! Aborting."; exit 1; }

    echo ">>> [REMOTE] 20.2 Stopping services..."
    remote_stop_services

    echo ">>> [REMOTE] 20.3 Backing up active sanvas.db and merging Parquet data..."
    if [ -f "$REMOTE_DATA_DIR/sanvas.db" ]; then
        sudo cp "$REMOTE_DATA_DIR/sanvas.db" "$REMOTE_DATA_DIR/sanvas.db.bak"
    fi

    sudo duckdb "$REMOTE_DATA_DIR/sanvas.db" <<'SQL'
CREATE TABLE IF NOT EXISTS sif_schemes (
    scheme_code VARCHAR NOT NULL,
    scheme_name VARCHAR NOT NULL,
    isin_div_payout_growth VARCHAR,
    isin_div_reinvestment VARCHAR,
    net_asset_value DOUBLE,
    repurchase_price DOUBLE,
    sale_price DOUBLE,
    date DATE NOT NULL,
    strategy_name VARCHAR,
    fund_house_name VARCHAR,
    fund_type VARCHAR,
    fund_company VARCHAR,
    fund_strategy VARCHAR,
    distribution_option VARCHAR,
    purchase_mode VARCHAR,
    PRIMARY KEY (scheme_code, date)
);

CREATE TABLE IF NOT EXISTS sif_indices (
    index_code VARCHAR NOT NULL,
    index_name VARCHAR NOT NULL,
    value DOUBLE NOT NULL,
    date DATE NOT NULL,
    PRIMARY KEY (index_code, date)
);

INSERT INTO sif_schemes 
SELECT * FROM read_parquet('/home/ec2-user/sif_schemes.parquet')
ON CONFLICT (scheme_code, date) DO UPDATE SET 
    scheme_name = EXCLUDED.scheme_name,
    isin_div_payout_growth = EXCLUDED.isin_div_payout_growth,
    isin_div_reinvestment = EXCLUDED.isin_div_reinvestment,
    net_asset_value = EXCLUDED.net_asset_value,
    repurchase_price = EXCLUDED.repurchase_price,
    sale_price = EXCLUDED.sale_price,
    strategy_name = EXCLUDED.strategy_name,
    fund_house_name = EXCLUDED.fund_house_name,
    fund_type = EXCLUDED.fund_type,
    fund_company = EXCLUDED.fund_company,
    fund_strategy = EXCLUDED.fund_strategy,
    distribution_option = EXCLUDED.distribution_option,
    purchase_mode = EXCLUDED.purchase_mode;

INSERT INTO sif_indices
SELECT * FROM read_parquet('/home/ec2-user/sif_indices.parquet')
ON CONFLICT (index_code, date) DO UPDATE SET
    index_name = EXCLUDED.index_name,
    value = EXCLUDED.value;
SQL

    echo ">>> [REMOTE] 20.4 Cleaning up Parquet and WAL files..."
    rm -f ~/sif_schemes.parquet
    rm -f ~/sif_indices.parquet
    if [ -f "$REMOTE_DATA_DIR/sanvas.db.wal" ]; then
        sudo rm -f "$REMOTE_DATA_DIR/sanvas.db.wal"
    fi

    echo ">>> [REMOTE] 20.5 Applying permissions..."
    remote_apply_permissions "$REMOTE_DATA_DIR"

    echo ">>> [REMOTE] 20.6 Restarting services..."
    remote_restart_services
}

deploy_sanvas() {
    log_info "Executing remote merge into sanvas.db on AWS..."
    ssh $SSH_OPTS -i "$KEY_FILE" "$REMOTE_USER_HOST" "REMOTE_DATA_DIR='$REMOTE_DATA_DIR' bash" << EOF
$(declare -f remote_stop_services remote_apply_permissions remote_restart_services remote_deploy_sanvas_task)
remote_deploy_sanvas_task
EOF
}


# 3. Main Execution
# ---------------------------------------------------------
log_info ">*>.>*>.>*>.>*>.>*>.>*>.>*>.>*>.>*>.>*>."
log_info "1. Starting Database Sync Workflow v2"
cd "$PROJECT_ROOT"

check_local_power
stop_local_server
run_local_fetcher
run_local_loader
resolve_remote_host
upload_sanvasify
deploy_sanvasify
update_sanvas
deploy_sanvas

log_info "9. Database Sync completed successfully at $(date '+%Y-%m-%d %H:%M:%S')."
log_info ">*>.>*>.>*>.>*>.>*>.>*>.>*>.>*>.>*>.>*>."