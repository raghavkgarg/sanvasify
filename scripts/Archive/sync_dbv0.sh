#!/bin/bash

# Prevent display, idle, system, and disk sleep while this script is running
caffeinate -dimsu -w $$ & 

# Exit immediately if a command exits with a non-zero status.
set -e

# Configuration - Update these if your environment changes
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure common paths are included for launchd/automation environments
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

#########################################
# Pre-flight Power Check (macOS specific)
echo "$(date): Battery check started."
BATT_INFO=$(pmset -g batt)
if [[ "$BATT_INFO" = *"Battery Power"* ]]; then
    

        BATT_PCT=$(echo "$BATT_INFO" | grep -o "[0-9]\{1,3\}%" | tr -d '%')
        RECIPIENT="raghavk.garg@icloud.com" # Replace with your Apple ID or Phone Number
        MSG="Sanvasify Mac Alert: Battery is at ${BATT_PCT}%. Please connect to power."

        echo "$(date): Battery is at ${BATT_PCT}%"
        if [ "$BATT_PCT" -lt 30 ]; then
            osascript -e "display notification \"$MSG\" with title \"Mac Battery Alert\""
            osascript -e "tell application \"Messages\" to send \"$MSG\" to buddy \"$RECIPIENT\"" &>/dev/null || true
            [ "$BATT_PCT" -lt 20 ] && echo "Critical Battery" && exit 1
        fi
else
    echo "$(date): Connected to AC power."
fi
echo "$(date): Battery check completed."

########################################

# Path check for AWS CLI
if ! command -v aws &> /dev/null; then
    echo "Error: aws CLI not found in PATH: $PATH" >&2
    exit 127
fi

# Force IST for local date commands
export TZ='Asia/Kolkata'

mkdir -p "$PROJECT_ROOT/scriptslog"
KEY_FILE="$PROJECT_ROOT/sn1.pem"
#REMOTE_USER_HOST="ec2-user@2406:da1a:5e:0:7e64:c4a0:6ed6:9c12"
LOCAL_DB="/Users/raghavgarg/Projects/duckdb/sanvasify/sanvasify.db"
REMOTE_DATA_DIR="/opt/sanvasify/data"
# Hardened SSH options to prevent hanging during network "flaps" or system sleep
# IPQoS=throughput helps prevent packet drops on unstable connections
SSH_OPTS="-o StrictHostKeyChecking=no \
          -o UserKnownHostsFile=/dev/null \
          -o BatchMode=yes \
          -o ServerAliveInterval=30 \
          -o ServerAliveCountMax=10 \
          -o IPQoS=throughput \
          -o ConnectTimeout=15"

# Colors for output
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'  
    YELLOW='\033[0;33m'
    NC='\033[0m'
    SSH_TTY="-t"
else
    GREEN=''
    RED=''
    YELLOW=''
    NC=''
    SSH_TTY=""
fi

    echo -e "${GREEN}>*>..${NC}\n"
    echo -e "${GREEN}>*>.Database Sync Script Version 1.0.0${NC}\n"
    echo -e "${GREEN}>*>..${NC}\n"
# Pre-flight check: Verify if the Local server is running and stop it to prevent database file locks during transfer
if  pgrep -f "dist/sanvasify" > /dev/null; then
    pkill -f "dist/sanvasify"
    echo -e "${RED}>>> [PRE-FLIGHT] Local Server stopped....${NC}\n"
else
    echo -e "${GREEN}>>> [PRE-FLIGHT] Local Server is not running...${NC}\n"
fi

cd "$PROJECT_ROOT"

echo -e "${GREEN}>>> [LOCAL] 1. Running Fetcher... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"

go build -o dist/fetch ./cmd/fetch

# Run fetcher and handle the "already up to date" signal (exit code 2)
set +e
./dist/fetch
FETCH_STATUS=$?
set -e

if [[ "$FETCH_STATUS" -eq 2 ]]; then
    echo ">>> [LOCAL] Data is already up to date. Skipping remaining steps."
    exit 0
elif [ $FETCH_STATUS -ne 0 ]; then
    exit $FETCH_STATUS
fi
echo -e "${GREEN}>>> [LOCAL] 1.1 Fetcher completed... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"


# Run loader for sanvasify.db
echo -e "${GREEN}>>> [LOCAL] Running Loader for sanvasify.db... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
./dist/load -db "/Users/raghavgarg/Projects/duckdb/sanvasify/sanvasify.db"

# Run loader for sanvas.db
echo -e "${GREEN}>>> [LOCAL] Running Loader for sanvas.db... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
./dist/load -db "/Users/raghavgarg/Projects/duckdb/sanvasify/sanvas.db"

# Resolve Public IP dynamically (prefer IPv4, fallback to IPv6)
INSTANCE_NAME="sanvasify-prod"
REMOTE_IP=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].PublicIpAddress" --output text 2>/dev/null)
REMOTE_IPV6=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].NetworkInterfaces[0].Ipv6Addresses[0].Ipv6Address" --output text 2>/dev/null)

IP_TO_USE=""
if [ -n "$REMOTE_IP" ] && [ "$REMOTE_IP" != "None" ]; then
    IP_TO_USE="$REMOTE_IP"
    echo -e "Resolved Public IPv4 for instance Name=$INSTANCE_NAME: ${GREEN}$REMOTE_IP${NC}"
elif [ -n "$REMOTE_IPV6" ] && [ "$REMOTE_IPV6" != "None" ]; then
    IP_TO_USE="$REMOTE_IPV6"
    echo -e "Public IPv4 not found. Resolved Public IPv6 for instance Name=$INSTANCE_NAME: ${GREEN}$REMOTE_IPV6${NC}"
else
    echo -e "${RED}Error: Could not resolve Public IPv4 or IPv6 for instance Name=$INSTANCE_NAME. Is it running?${NC}"
    exit 1
fi

# Format for SSH (IPv6 literals should NOT be bracketed for standard SSH on macOS)
REMOTE_USER_HOST="ec2-user@$IP_TO_USE"
echo -e "${GREEN}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>..${NC}\n"
echo -e "${GREEN}>>> Starting Database Sync Workflow on $(date '+%Y-%m-%d %H:%M:%S') .${NC}"

# connectivity check after loader
echo ">>> [NETWORK] Checking SSH connectivity to AWS..."
if ! ssh $SSH_OPTS -i "$KEY_FILE" -o ConnectTimeout=5 -o BatchMode=yes "$REMOTE_USER_HOST" exit; then
    # Detect local public IP for troubleshooting (Try IPv4 for 5s, fallback to IPv6)
    CURRENT_IP=$(curl -f -4 -s --noproxy "*" --connect-timeout 5 https://checkip.amazonaws.com 2>/dev/null || echo "")
    [ -z "$CURRENT_IP" ] && CURRENT_IP=$(curl -f -6 -s --noproxy "*" --connect-timeout 5 https://ident.me 2>/dev/null || echo "unknown")
    echo -e "\n${RED}Error: Connection to AWS failed.${NC}"
    echo -e "${YELLOW}Ensure your current IP (${CURRENT_IP}) is allowed in the AWS Security Group for port 22.${NC}\n"
    exit 1
fi

echo -e "${GREEN}>>> [LOCAL] 3. Uploading Database to staging area on AWS... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
# SCP requires brackets for IPv6 literals to distinguish from the host/path separator
SCP_DEST="$REMOTE_USER_HOST"
if [[ "$IP_TO_USE" == *:* ]]; then
    SCP_DEST="ec2-user@[$IP_TO_USE]"
fi

# Retry logic for SCP to handle "Broken pipe" or "Connection reset"
MAX_RETRIES=3
RETRY_COUNT=0
until scp $SSH_OPTS -i "$KEY_FILE" "$LOCAL_DB" "$SCP_DEST:~/"; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}Error: SCP failed after $MAX_RETRIES attempts.${NC}"
        exit 1
    fi
    echo -e "${YELLOW}Warning: SCP failed. Retrying ($RETRY_COUNT/$MAX_RETRIES)...${NC}"
    sleep 5
done

echo -e "${GREEN}>>> [REMOTE] Executing Deployment Steps (4-9)... ${NC}\n"
ssh $SSH_OPTS -i "$KEY_FILE" "$REMOTE_USER_HOST" "TZ='Asia/Kolkata' REMOTE_DATA_DIR='$REMOTE_DATA_DIR' GREEN='$GREEN' YELLOW='$YELLOW' RED='$RED' NC='$NC' bash" << 'EOF'
    set -e # Exit immediately if a command fails on the remote server
    # 4. Stop Services (Stopping first ensures the database file isn't in use)
    echo -e "${GREEN}>>> [REMOTE] 4. Stopping Sanvasify and Caddy services...... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"

    sudo systemctl stop sanvasify
    sudo systemctl stop caddy

    # 5 & 6. Move Database & Handle Migration (Cleanup WAL)
    
    if [ -z "$REMOTE_DATA_DIR" ] || [ "$REMOTE_DATA_DIR" == "/" ] || [ "$REMOTE_DATA_DIR" == "/home" ]; then
        echo -e "${RED}Error: REMOTE_DATA_DIR is empty or invalid ($REMOTE_DATA_DIR). Aborting to protect system integrity.${NC}"
        exit 1
    fi

    if [ -z "$REMOTE_DATA_DIR" ]; then
        echo -e "${RED}Error: REMOTE_DATA_DIR is empty. Aborting to prevent accidental root operation.${NC}"
        exit 1
    fi

    if [ -f ~/sanvasify.db ]; then
        echo -e "${GREEN}>>> [REMOTE] 5 & 6. Moving new database to $REMOTE_DATA_DIR... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
        sudo mv ~/sanvasify.db $REMOTE_DATA_DIR/
     
        # Remove WAL file to prevent corruption on swap
        if [ -f $REMOTE_DATA_DIR/sanvasify.db.wal ]; then
            sudo rm -f $REMOTE_DATA_DIR/sanvasify.db.wal
        fi
    fi

    # 7. Verify database permissions (critical for security and functionality)
    echo -e "${GREEN}>>> [REMOTE] 7. Applying ownership and permissions... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
    sudo chown -R sanvasify:sanvasify $REMOTE_DATA_DIR/
    sudo chmod 750 $REMOTE_DATA_DIR/

    # 9. Start Services
    echo -e "${GREEN}>>> [REMOTE] 9. Reloading systemd and restarting services... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
    sudo systemctl daemon-reload
    sudo systemctl start sanvasify
    sudo systemctl start caddy
    
    echo "Deployment complete. Sanvasify status: $(sudo systemctl is-active sanvasify)"
EOF
echo -e "${GREEN}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>.${NC}"
echo -e ">>> Database Workflow Finished Successfully.. on $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
echo -e "${GREEN}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>.${NC}\n"
