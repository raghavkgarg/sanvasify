#!/bin/bash

# status_AWSv2.sh - Refactored and modularized AWS verification script

# 1. Initialization and Configuration
# ---------------------------------------------------------
set -e

# Prevent sleep while this script is running
caffeinate -i -w $$ & 

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure common paths are included
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export TZ='Asia/Kolkata'

# Constants
KEY_FILE="$PROJECT_ROOT/sn1.pem"
INSTANCE_NAME="sanvasify-prod"

# Colors
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; NC=''
fi

# SSH Hardening
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o ServerAliveInterval=10 -o ServerAliveCountMax=3 -o ConnectTimeout=10"
SSH_TTY="-t"

# 2. Utility Functions
# ---------------------------------------------------------
log_section() { echo -e "\n${YELLOW}=== $1 ===${NC}"; }
log_info()    { echo -e "${GREEN}>>> [INFO] $1${NC}"; }
log_warn()    { echo -e "${YELLOW}>>> [WARN] $1${NC}"; }
log_error()   { echo -e "${RED}>>> [ERROR] $1${NC}"; }
die()         { log_error "$1"; exit 1; }

check_dependencies() {
    if ! command -v aws &> /dev/null; then
        die "aws CLI not found in PATH. Please install it to continue."
    fi
}

resolve_remote_host() {
    log_info "Resolving AWS instance IP for '$INSTANCE_NAME'..."
    local ipv4=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].PublicIpAddress" --output text 2>/dev/null)
    local ipv6=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].NetworkInterfaces[0].Ipv6Addresses[0].Ipv6Address" --output text 2>/dev/null)

    if [ -n "$ipv4" ] && [ "$ipv4" != "None" ]; then
        REMOTE_IP="$ipv4"
        log_info "Resolved Public IPv4: $REMOTE_IP"
    elif [ -n "$ipv6" ] && [ "$ipv6" != "None" ]; then
        REMOTE_IP="$ipv6"
        log_info "Resolved Public IPv6: $REMOTE_IP"
    else
        die "Could not resolve a public IP. Ensure the instance is running and tagged correctly."
    fi
    REMOTE_USER_HOST="ec2-user@$REMOTE_IP"
}

get_aws_costs() {
    log_section "Local: AWS Account Cost Analysis (Month-to-Date)"
    local START_DATE=$(date +%Y-%m-01)
    local END_DATE=$(date +%Y-%m-%d)

    aws ce get-cost-and-usage --time-period Start=$START_DATE,End=$END_DATE --granularity DAILY --metrics "BlendedCost" --query "ResultsByTime[].[TimePeriod.Start,Total.BlendedCost.Amount]" --output text 2>/dev/null | awk -v today="$(date +%y%m%d)" '
    BEGIN { total=0; printf "%-10s | %-10s\n", "Date", "Cost (USD)"; printf "-----------|-----------\n" }
    {
        # Portable date formatting: YYYY-MM-DD -> YYMMDD
        d=$1; gsub("-","",d); d=substr(d,3);
        printf "%-10s | $%.2f\n", d, $2;
        total+=$2
    }
    END { if (NR>0) { printf "-----------|-----------\n"; printf "Total      | $%.4f\n", total } else { print "No cost data available." } }'
}

run_remote_diagnostics() {
    log_section "Remote: System Diagnostics on $REMOTE_IP"
    ssh $SSH_OPTS $SSH_TTY -i "$KEY_FILE" "$REMOTE_USER_HOST" "TZ='Asia/Kolkata' GREEN='$GREEN' YELLOW='$YELLOW' RED='$RED' NC='$NC' bash -s" << 'EOF'
        set -e

        # 1. System Health
        echo -e "${YELLOW}--- 1. System Health ---${NC}"
        echo -n "Uptime:       " && uptime -p
        echo -n "Load Average: " && cat /proc/loadavg | awk '{print $1, $2, $3}'
        free -h | grep -E 'Mem:|Swap:'
        echo ""

        # 2. Disk Space
        echo -e "${YELLOW}--- 2. Disk Space Verification ---${NC}"
        DISK_PCT=$(sudo df /opt/sanvasify/data --output=pcent | tail -1 | tr -dc '0-9')
        if [ "$DISK_PCT" -lt 70 ]; then
            echo -e "Status: ${GREEN}OK ($DISK_PCT% used)${NC}"
        else
            echo -e "Status: ${RED}WARNING: High usage ($DISK_PCT% used)${NC}"
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

        # 3. Database Integrity
        echo -e "${YELLOW}--- 3. Database Verification ---${NC}"
        DB_PATH="/opt/sanvasify/data/sanvasify.db"
        if sudo [ -f "$DB_PATH" ]; then
            sudo ls -lh "$DB_PATH"
            DUCKDB_CMD=$(command -v duckdb || echo "/usr/local/bin/duckdb")
            if [ -x "$DUCKDB_CMD" ]; then
                TEMP_DB="/tmp/status_snapshot_$$.db"
                sudo cp "$DB_PATH" "$TEMP_DB"
                sudo chmod 644 "$TEMP_DB"
                
                # Fetch stats
                echo -n "Total Records: "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT COUNT(*) FROM sif_schemes;" 2>/dev/null || echo "Table not found"
                echo -n "Latest Entry:  "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT MAX(date) FROM sif_schemes;" 2>/dev/null || echo "N/A"
                echo -n "Current date in LINUX: $(date '+%Y-%m-%d'): "
                echo -n "Current date in DuckDB Time Method: "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT (now() + interval '5 hours 30 minutes')::DATE;" 2>/dev/null || echo "Error"

                echo -e "${GREEN}>%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%.${NC}"
                echo -n "Time Method - No of Schemes Loaded for $(date '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT COUNT(*) FROM sif_schemes WHERE date = (now() + interval '5 hours 30 minutes')::DATE;" 2>/dev/null || echo "Error"
                echo -n "Time Method - No of Schemes Loaded for $(date -d 'yesterday' '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT COUNT(*) FROM sif_schemes WHERE date = (now() + interval '5 hours 30 minutes')::DATE - INTERVAL 1 DAY;" 2>/dev/null || echo "Error"
                echo -n "Time Method - No of Schemes Loaded for $(date -d '2 days ago' '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT COUNT(*) FROM sif_schemes WHERE date = (now() + interval '5 hours 30 minutes')::DATE - INTERVAL 2 DAY;" 2>/dev/null || echo "Error"
                echo -e "${GREEN}>%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%.${NC}"

                echo -e "Count Method - No of Schemes Loaded for last 14 days from current date:\n"
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT date, COUNT(*) FROM sif_schemes GROUP BY date ORDER BY date DESC LIMIT 14;" 2>/dev/null || echo "Error"

                sudo rm -f "$TEMP_DB"
            fi
        else
            echo -e "${RED}Error: Database file missing at $DB_PATH${NC}"
        fi
        echo ""

        # 4. Service & Port Status
        echo -e "${YELLOW}--- 4. Services & Connectivity ---${NC}"
        for svc in sanvasify caddy; do
            if systemctl is-active --quiet "$svc"; then
                echo -e "$svc: ${GREEN}ACTIVE${NC}"
            else
                echo -e "$svc: ${RED}DOWN${NC}"
            fi
        done

        echo -e "\nPort Listeners:"
        for port in 80 443 8080; do
            if ss -tln | grep -q ":$port "; then
                echo -e "Port $port: ${GREEN}OPEN${NC}"
            else
                echo -e "Port $port: ${RED}CLOSED${NC}"
            fi
        done
        echo ""

        # 5. API Health Check
        echo -e "${YELLOW}--- 5. API Health Check ---${NC}"
        HEALTH=$(curl -s http://localhost:8080/health || echo "unreachable")
        echo -e "Response: ${GREEN}$HEALTH${NC}"
        echo ""

        # 6. API Count Check
        echo -e "${YELLOW}--- 6. API Session Count Check ---${NC}"
        Count=$(curl -s  http://localhost:8080/api/session/count || echo "unreachable")
        echo -e "Response: ${GREEN}$Count${NC}"
        echo ""

        # 7. SSL Expiration
        echo -e "${YELLOW}--- 7. SSL Certificate Status ---${NC}"
        CERT_FILE=$(sudo find /caddy/certificates/ /var/lib/caddy/ -name "*.crt" -o -name "cert.pem" 2>/dev/null | head -n 1)
        if [ -n "$CERT_FILE" ]; then
            END_DATE_STR=$(sudo openssl x509 -in "$CERT_FILE" -noout -enddate | cut -d= -f2)
            DAYS_LEFT=$(( ( $(date -d "$END_DATE_STR" +%s) - $(date +%s) ) / 86400 ))
            if [ "$DAYS_LEFT" -lt 15 ]; then
                echo -e "Status: ${RED}CRITICAL: $DAYS_LEFT days remaining${NC} ($END_DATE_STR)"
            else
                echo -e "Status: ${GREEN}OK: $DAYS_LEFT days remaining${NC} ($END_DATE_STR)"
            fi
        else
            echo "No SSL certificates found."
        fi
        echo ""

        # 8. IP Address Detection
        echo -e "${YELLOW}--- 8. Remote IP Verification ---${NC}"
        # Internal detection (IPv4 via IMDSv2 and External IPv6)
        TOKEN=$(curl -f -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || echo "")
        if [ -n "$TOKEN" ]; then
            V4_INT=$(curl -f -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "none")
            echo "Public IPv4: $V4_INT"
        fi
        V6_EXT=$(curl -f -6 -s https://ident.me 2>/dev/null || echo "none")
        echo "Public IPv6: $V6_EXT"
        echo ""

        # 9. Logs
        echo -e "${YELLOW}--- 9. Recent Logs (sanvasify) ---${NC}"
        sudo journalctl -u sanvasify -n 5 --no-pager | sed 's/^/  /'
EOF
}

verify_public_endpoint() {
    log_section "10. External: Public Endpoint Verification"
    local TARGET_DOMAIN="https://sanvasify.com"

    if curl -s --fail --connect-timeout 5 "$TARGET_DOMAIN" > /dev/null 2>&1; then
        echo -e "Public Domain ($TARGET_DOMAIN): ${GREEN}REACHABLE${NC}"
    elif curl -s -k --connect-timeout 5 "https://$REMOTE_IP/" > /dev/null 2>&1; then
        echo -e "Public IP ($REMOTE_IP): ${GREEN}REACHABLE${NC} (Domain check failed)"
    else
        log_warn "Public endpoint is not responding via Domain or IP. Check DNS and Security Groups."
    fi
}

# 3. Main Execution
# ---------------------------------------------------------
echo -e "${GREEN}"
echo "********************************************************"
echo "   AWS INSTANCE VERIFICATION WORKFLOW v2                "
echo "   Started at: $(date '+%Y-%m-%d %H:%M:%S')             "
echo "********************************************************"
echo -e "${NC}"

check_dependencies
resolve_remote_host
get_aws_costs
run_remote_diagnostics
verify_public_endpoint

echo -e "\n${GREEN}********************************************************"
echo "   Verification Completed Successfully"
echo "********************************************************"