#!/bin/bash

# Awake till this script finishes (prevents sleep on macOS during long operations)
caffeinate -i -w $$ & 

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure common paths are included for launchd/automation environments
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

KEY_FILE="$PROJECT_ROOT/sn1.pem"
# REMOTE_USER_HOST="ec2-user@13.234.173.198"


# Path check for debugging launchd
if ! command -v aws &> /dev/null; then
    echo "Error: aws CLI not found in PATH: $PATH" >&2
    exit 127
fi

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

# Dynamically fetch the Public IP using the AWS CLI based on the instance Name tag
# Ensure your instance has the tag Name=Sanvasify-prod and is in the running state for this to work
INSTANCE_NAME="sanvasify-prod"
REMOTE_IP=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].PublicIpAddress" --output text 2>/dev/null)
REMOTE_IPV6=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].NetworkInterfaces[0].Ipv6Addresses[0].Ipv6Address" --output text 2>/dev/null)

IP_TO_USE=""

if [ -n "$REMOTE_IP" ] && [ "$REMOTE_IP" != "None" ]; then
    IP_TO_USE="$REMOTE_IP"
    echo -e "${YELLOW}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>.${NC}"
    echo -e "Resolved Public IPv4 for instance with tag Name=$INSTANCE_NAME. IP is ${GREEN}$REMOTE_IP${NC}"
    [ -n "$REMOTE_IPV6" ] && [ "$REMOTE_IPV6" != "None" ] && echo -e "Resolved Public IPv6 for instance with tag Name=$INSTANCE_NAME. IP is ${GREEN}$REMOTE_IPV6${NC}"
elif [ -n "$REMOTE_IPV6" ] && [ "$REMOTE_IPV6" != "None" ]; then
    IP_TO_USE="$REMOTE_IPV6"
    echo -e "${YELLOW}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>.${NC}"
    echo -e "Public IPv4 not found. Resolved Public IPv6 for instance with tag Name=$INSTANCE_NAME. IP is ${GREEN}$REMOTE_IPV6${NC}"
else
    echo -e "${YELLOW}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>.${NC}"
    echo -e "${RED}Error: Could not resolve Public IPv4 or IPv6 for instance with tag Name=$INSTANCE_NAME. Is it running?${NC}"
    exit 1
fi

# Format for SSH (IPv6 literals should NOT be bracketed for standard SSH on macOS)
REMOTE_USER_HOST="ec2-user@$IP_TO_USE"

# Force IST for local date commands
export TZ='Asia/Kolkata'


# SSH Hardening for Automation:
# BatchMode=yes: No interactive prompts
# ServerAliveInterval/CountMax: Detects network "flaps" and drops dead connections within 30 seconds
# ConnectTimeout: Prevents hanging during the initial handshake
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o ServerAliveInterval=10 -o ServerAliveCountMax=3 -o ConnectTimeout=10"

echo -e "${GREEN}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>.${NC}"
echo -e "${GREEN}>>> Connecting to AWS to verify Sanvasify status on $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"

ssh $SSH_OPTS $SSH_TTY -i "$KEY_FILE" "$REMOTE_USER_HOST" "TZ='Asia/Kolkata' GREEN='$GREEN' YELLOW='$YELLOW' RED='$RED' NC='$NC' bash -s" << 'EOF'
    # Colors for remote output
    # 0. System Health Overview
    echo -e "${YELLOW}--- 0. System Health Overview ---${NC}"
    echo -n "Uptime:       " && uptime -p
    echo -n "Load Average: " && cat /proc/loadavg | awk '{print $1, $2, $3}'
    echo "Memory Usage:"
    free -h | grep -E 'Mem:|Swap:'
    echo ""

    # 1. Disk Space Verification (Phase 4.1)
    echo -e "${YELLOW}--- 1. Disk Space Verification ---${NC}"
    DISK_USAGE=$(sudo df /opt/sanvasify/data --output=pcent | tail -1 | tr -dc '0-9')
    if [ -n "$DISK_USAGE" ] && [ "$DISK_USAGE" -lt 50 ]; then
        echo -e "Status: ${GREEN}DISK is Fine ($DISK_USAGE% used)${NC}"
    else
        echo -e "Status: ${RED}DISK Threshold passed or unreachable ($DISK_USAGE% used)${NC}"
    fi
    sudo df -h /opt/sanvasify/data | grep -v Filesystem

    echo -e "\nDetailed Usage Findings:"
    echo -e "  - Journal Logs:      ${YELLOW}$(sudo du -sh /var/log/journal 2>/dev/null | awk '{print $1}' || echo '0')${NC}"
    echo -e "  - Audit Logs:        ${YELLOW}$(sudo du -sh /var/log/audit 2>/dev/null | awk '{print $1}' || echo '0')${NC}"
    echo -e "  - System Activity:   ${YELLOW}$(sudo du -sh /var/log/sa 2>/dev/null | awk '{print $1}' || echo '0')${NC}"
    echo -e "  - DuckDB Extensions: ${YELLOW}$(sudo du -sh /root/.duckdb 2>/dev/null | awk '{print $1}' || echo '0')${NC}"
    echo -e "  - Application (/opt):${YELLOW}$(sudo du -sh /opt/sanvasify 2>/dev/null | awk '{print $1}' || echo '0')${NC}"
    echo -e "  - Package Cache:     ${YELLOW}$(sudo du -sh /var/cache 2>/dev/null | awk '{print $1}' || echo '0')${NC}"

    echo ""

    # 2. Database File Verification (Phase 4.1)
    echo -e "${YELLOW}--- 2. Database File & Content Verification ---${NC}"
    DB_PATH="/opt/sanvasify/data/sanvasify.db"
    DB_LIMIT_MB=500
    if sudo [ -f "$DB_PATH" ]; then
        sudo ls -la "$DB_PATH"

        # Database Size Check
        DB_SIZE_MB=$(sudo du -m "$DB_PATH" | awk '{print $1}')
        if [ "$DB_SIZE_MB" -lt "$DB_LIMIT_MB" ]; then
            echo -e "DB Size:       ${GREEN}Fine ($DB_SIZE_MB MB)${NC}"
        else
            echo -e "DB Size:       ${RED}Threshold passed ($DB_SIZE_MB MB)${NC}"
        fi

        # Check record count if duckdb is installed
        DUCKDB_CMD=$(command -v duckdb || echo "/usr/local/bin/duckdb")
        if [ -x "$DUCKDB_CMD" ]; then
            # Snapshot approach: Copy DB to temp to bypass exclusive lock held by the running application
            TEMP_DB="/tmp/status_snapshot_$$.db"
            sudo cp "$DB_PATH" "$TEMP_DB"
            sudo chmod 644 "$TEMP_DB" # Reverted to 644 for better security

            # Check if table exists first (run duckdb with sudo to avoid permission issues)
            TABLE_CHECK=$(sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT name FROM information_schema.tables WHERE table_name='sif_schemes';" 2>&1)
            if [ -z "$TABLE_CHECK" ]; then
                echo -e "${RED}Error: Table 'sif_schemes' not found in database${NC}"
                echo "Available tables:"
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT table_name FROM information_schema.tables;" 2>&1
            else
                echo -e "Table Status:  ${GREEN}sif_schemes found${NC}"
                echo -n "Total Records: "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT COUNT(*) FROM sif_schemes;" 2>/dev/null || echo "Error"
                echo -n "Latest Date:   "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT MAX(date) FROM sif_schemes;" 2>/dev/null || echo "Error"
                echo -n "Current date in LINUX: $(date -d "today" '+%Y-%m-%d'): "        
                echo -n "Current date in DuckDB Time Method: "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT (now() + interval '5 hours 30 minutes')::DATE;" 2>/dev/null || echo "Error"
                echo -e "${GREEN}>%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%.${NC}"
                echo -n "Time Method - No of Schemes Loaded for $(date -d "today" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT COUNT(*) FROM sif_schemes WHERE date = (now() + interval '5 hours 30 minutes')::DATE;" 2>/dev/null || echo "Error"
                echo -n "Time Method - No of Schemes Loaded for $(date -d "yesterday" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT COUNT(*) FROM sif_schemes WHERE date = (now() + interval '5 hours 30 minutes')::DATE - INTERVAL 1 DAY;" 2>/dev/null || echo "Error"
                echo -n "Time Method - No of Schemes Loaded for $(date -d "2 days ago" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT COUNT(*) FROM sif_schemes WHERE date = (now() + interval '5 hours 30 minutes')::DATE - INTERVAL 2 DAY;" 2>/dev/null || echo "Error"
                echo -e "${GREEN}>%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%.${NC}"
                echo -e "Count Method - No of Schemes Loaded for last 14 days from current date: \n"
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "
                                                                    select date, COUNT(*) as cnt
                                                                            from sif_schemes
                                                                            group by date
                                                                            order by date desc
                                                                            Limit  14;
                                                                 " 2>/dev/null || echo "Error"
            fi
            sudo rm -f "$TEMP_DB"
        else
            echo -e "${YELLOW}Note: 'duckdb' CLI not found, skipping deep data check.${NC}"
            echo "To enable: sudo wget -O /usr/local/bin/duckdb.zip https://github.com/duckdb/duckdb/releases/download/v1.1.3/duckdb_cli-linux-aarch64.zip && sudo unzip -o /usr/local/bin/duckdb.zip -d /usr/local/bin/ && sudo rm /usr/local/bin/duckdb.zip"
        fi
    else
        echo -e "${RED}Error: Database file not found at $DB_PATH${NC}"
    fi
    echo ""

    # 3. Service Status Verification (Phase 4.5)
    echo -e "${YELLOW}--- 3. Service Status Verification ---${NC}"
    SERVICES=("sanvasify" "caddy")
    for service in "${SERVICES[@]}"; do
        if systemctl is-active --quiet "$service"; then
            echo -e "$service: ${GREEN}ACTIVE${NC}"
        else
            echo -e "$service: ${RED}INACTIVE/FAILED${NC}"
            sudo systemctl status "$service" --no-pager -n 5
        fi
    done
    echo ""

    # 4. Port Listening Verification (Phase 4.3)
    echo -e "${YELLOW}--- 4. Port Listening Verification ---${NC}"
    # Checking for processes on 80 (HTTP), 443 (HTTPS), and 8080 (Internal App)
    sudo ss -tlnp | grep -E ':(80|443|8080)' || echo -e "${RED}Warning: No processes listening on ports 80, 443, or 8080${NC}"
    echo ""
    PORTS=(80 443 8080)
    LABELS=("80 (HTTP)          " "443 (HTTPS)        " "8080 (Internal App)")
    for i in "${!PORTS[@]}"; do
        PORT=${PORTS[$i]}
        LABEL=${LABELS[$i]}
        if sudo ss -tln | grep -q ":$PORT "; then
            echo -e "$LABEL: ${GREEN}Listening Fine${NC}"
        else
            echo -e "$LABEL: ${RED}NOT LISTENING${NC}"
        fi
    done
    echo ""

    HEALTH_RESP=$(curl -s http://localhost:8080/health)
    if echo "$HEALTH_RESP" | jq . >/dev/null 2>&1; then
        echo "$HEALTH_RESP" | jq .
    else
        echo -e "Health Check Response: ${YELLOW}$HEALTH_RESP${NC} (Non-JSON or Service Down)"
    fi
    echo ""


    # 5. Local API Health Checks (Phase 4.4)
    echo -e "${YELLOW}--- 5. Local API Health Check ---${NC}"
    if curl -s --fail http://localhost:8080/api/schemes > /dev/null; then
        echo -e "Internal API (8080): ${GREEN}UP${NC}"
    else
        echo -e "Internal API (8080): ${RED}DOWN${NC}"
    fi

    # Note: This might fail if SSL is mandatory and Host headers aren't set correctly
    if curl -s --fail -I http://localhost/ > /dev/null; then
        echo -e "Public Web Gateway:  ${GREEN}UP${NC}"
    else
        echo -e "Public Web Gateway:  ${RED}NOT RESPONDING (Check Caddy status)${NC}"
    fi
    echo ""

    # 6. Configuration Verification (Phase 4.2)
    echo -e "${YELLOW}--- 6. Configuration Verification ---${NC}"
    CONFIG_FILE="/opt/sanvasify/config/Config.toml"
    if [ -f "$CONFIG_FILE" ]; then
        if sudo -u sanvasify cat "$CONFIG_FILE" > /dev/null 2>&1; then
            echo -e "Config File: ${GREEN}READABLE by sanvasify user${NC}"
            grep "db_path" "$CONFIG_FILE"
        else
            echo -e "Config File: ${RED}PERMISSION DENIED (Not readable by sanvasify user)${NC}"
        fi
    fi
    echo ""

    # 7. Caddy SSL Certificate Expiration
    echo -e "${YELLOW}--- 7. Caddy SSL Certificate Expiration ---${NC}"
    # On this instance, Caddy data is located in /caddy/certificates
    CERT_FILE=$(sudo find /caddy/certificates/ /var/lib/caddy/ -name "*.crt" -o -name "cert.pem" 2>/dev/null | head -n 1)

    if [ -z "$CERT_FILE" ]; then
        echo -e "${RED}Error: No Caddy SSL certificate found in expected location.${NC}"
        echo "Checked: /caddy/certificates/ and /var/lib/caddy/"
    else
        EXPIRATION_DATE_STR=$(sudo openssl x509 -in "$CERT_FILE" -noout -enddate 2>/dev/null | cut -d= -f2)
        if [ -z "$EXPIRATION_DATE_STR" ]; then
            echo -e "${RED}Error: Could not parse expiration date from $CERT_FILE.${NC}"
        else
            # Convert expiration date string to timestamp, then calculate days left
            EXPIRATION_TIMESTAMP=$(date -d "$EXPIRATION_DATE_STR" +%s)
            CURRENT_TIMESTAMP=$(date +%s)
            DAYS_LEFT=$(( (EXPIRATION_TIMESTAMP - CURRENT_TIMESTAMP) / (60*60*24) ))

            echo "Certificate: $CERT_FILE"
            echo "Expires On:  $EXPIRATION_DATE_STR"
            echo "Days Left:   $DAYS_LEFT"

            if [ "$DAYS_LEFT" -le 7 ]; then # Critical: less than 7 days
                echo -e "Status:      ${RED}CRITICAL: Certificate expires in $DAYS_LEFT days!${NC}"
            elif [ "$DAYS_LEFT" -le 30 ]; then # Warning: less than 30 days
                echo -e "Status:      ${RED}WARNING: Certificate expires in $DAYS_LEFT days.${NC}"
            else
                echo -e "Status:      ${GREEN}OK: Certificate expires in $DAYS_LEFT days.${NC}"
            fi
        fi
    fi
    echo ""

    # 8 Public IPv6 Address
    echo -e "${YELLOW}--- 8. Public IPv6 Address ---${NC}"
    PUBLIC_IPV6=$(curl -f -6 -s --connect-timeout 5 --max-time 10 https://ident.me 2>/dev/null || echo "")
    if [ -n "$PUBLIC_IPV6" ]; then
        echo -e "Public IPv6: ${GREEN}$PUBLIC_IPV6${NC}"
    else
        echo -e "Public IPv6: ${YELLOW}Not detected or no IPv6 connectivity${NC}"
    fi
    echo ""

    # 10. Public IPv4 Address
    echo -e "${YELLOW}--- 10. Public IPv4 Address ---${NC}"
    # Prefer EC2 Metadata service for reliability and speed (IMDSv2 supported)
    TOKEN=$(curl -f -s --noproxy "*" -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" --connect-timeout 2 --max-time 2 2>/dev/null || echo "")
    if [ -n "$TOKEN" ]; then
        PUBLIC_IPV4=$(curl -f -s --noproxy "*" -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 --connect-timeout 2 --max-time 2 2>/dev/null || echo "")
    fi
    
    # Fallback to external service if metadata is disabled or fails
    if [ -z "$PUBLIC_IPV4" ]; then
        PUBLIC_IPV4=$(curl -f -4 -s --connect-timeout 5 --max-time 10 https://checkip.amazonaws.com 2>/dev/null || echo "")
    fi

    if [ -n "$PUBLIC_IPV4" ]; then
        echo -e "Public IPv4: ${GREEN}$PUBLIC_IPV4${NC}"
    else
        echo -e "Public IPv4: ${RED}Could not retrieve${NC}"
    fi
    echo ""

    # 11. Recent Application Logs
    echo -e "${YELLOW}--- 11. Recent Application Logs (Last 10 lines) ---${NC}"
    sudo journalctl -u sanvasify -n 10 --no-pager
EOF
echo -e "${GREEN}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>.${NC}"
echo -e "${GREEN}>>> Verification Completed at $(date '+%Y-%m-%d %H:%M:%S').${NC}"
echo -e "${GREEN}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>..${NC}\n"
