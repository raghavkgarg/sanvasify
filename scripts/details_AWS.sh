#!/bin/bash

# details_AWS.sh - Refactored AWS Infrastructure and Cost Report

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

INSTANCE_NAME="sanvasify-prod"

# Colors
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; NC=''
fi

# 2. Utility Functions
# ---------------------------------------------------------
log_section() { echo -e "\n${YELLOW}=== $1 ===${NC}"; }
log_info()    { echo -e "${GREEN}>>> [INFO] $1${NC}"; }
log_error()   { echo -e "${RED}>>> [ERROR] $1${NC}"; }
die()         { log_error "$1"; exit 1; }

check_dependencies() {
    for cmd in aws jq; do
        if ! command -v $cmd &> /dev/null; then
            die "$cmd CLI not found. Please install it to continue."
        fi
    done
}

get_aws_costs() {
    log_section "AWS Account Cost Analysis (Month-to-Date)"
    local START_DATE=$(date +%Y-%m-01)
    local END_DATE=$(date +%Y-%m-%d)

    aws ce get-cost-and-usage --time-period Start=$START_DATE,End=$END_DATE --granularity DAILY --metrics "BlendedCost" --query "ResultsByTime[].[TimePeriod.Start,Total.BlendedCost.Amount]" --output text 2>/dev/null | awk -v today="$(date +%y%m%d)" '
    BEGIN { total=0; printf "%-10s | %-10s\n", "Date", "Cost (USD)"; printf "-----------|-----------\n" }
    {
        d=$1; gsub("-","",d); d=substr(d,3);
        printf "%-10s | $%.2f\n", d, $2;
        total+=$2
    }
    END { if (NR>0) { printf "-----------|-----------\n"; printf "Total      | $%.4f\n", total } else { print "No cost data available." } }'
}

get_infrastructure_details() {
    log_section "Infrastructure Discovery: $INSTANCE_NAME"
    
    # 1. Fetch Instance details
    # We fetch the raw JSON without silencing errors to reveal actual API or credential issues
    INSTANCE_RAW=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running" --output json)

    if [[ $(echo "$INSTANCE_RAW" | jq '.Reservations | length') -eq 0 ]]; then
        die "No running instance found with name '$INSTANCE_NAME'. Verify the Name tag is exact (case-sensitive) and the instance state is 'running'."
    fi

    INSTANCE_DETAILS=$(echo "$INSTANCE_RAW" | jq '.Reservations[0].Instances[0]')

    # Extract values using jq
    INSTANCE_ID=$(echo "$INSTANCE_DETAILS" | jq -r '.InstanceId // "None"')
    SUBNET_ID=$(echo "$INSTANCE_DETAILS" | jq -r '.SubnetId // "None"')
    SECURITY_GROUPS=$(echo "$INSTANCE_DETAILS" | jq -r '.SecurityGroups[].GroupId' | tr '\n' ' ' | sed 's/ $//')
    CURRENT_AMI=$(echo "$INSTANCE_DETAILS" | jq -r '.ImageId // "None"')
    IAM_ROLE=$(echo "$INSTANCE_DETAILS" | jq -r '.IamInstanceProfile.Arn // "None"')
    INSTANCE_TYPE=$(echo "$INSTANCE_DETAILS" | jq -r '.InstanceType // "None"')
    KEY_NAME=$(echo "$INSTANCE_DETAILS" | jq -r '.KeyName // "None"')
    CURRENT_IPV6=$(echo "$INSTANCE_DETAILS" | jq -r '.NetworkInterfaces[0].Ipv6Addresses[0].Ipv6Address // "None"')

    # 1.1 Fetch Additional Instance Attributes
    TENANCY=$(echo "$INSTANCE_DETAILS" | jq -r '.Placement.Tenancy // "None"')
    PLACEMENT_GROUP=$(echo "$INSTANCE_DETAILS" | jq -r '.Placement.GroupName // "None"')
    MONITORING=$(echo "$INSTANCE_DETAILS" | jq -r '.Monitoring.State // "None"')

    USER_DATA_RAW=$(aws ec2 describe-instance-attribute --instance-id "$INSTANCE_ID" --attribute userData --query "UserData.Value" --output text 2>/dev/null)
    if [ "$USER_DATA_RAW" != "None" ] && [ -n "$USER_DATA_RAW" ]; then
        USER_DATA=$(echo "$USER_DATA_RAW" | base64 --decode 2>/dev/null || echo "Encoded: $USER_DATA_RAW")
    else
        USER_DATA="None"
    fi

    # 2. Fetch Subnet details
    if [ "$SUBNET_ID" != "None" ]; then
        SUBNET_RAW=$(aws ec2 describe-subnets --subnet-ids "$SUBNET_ID" --output json)
        SUBNET_INFO=$(echo "$SUBNET_RAW" | jq '.Subnets[0]')
        IPV6_BLOCKS=$(echo "$SUBNET_INFO" | jq -r '.Ipv6CidrBlockAssociationSet[]?.Ipv6CidrBlock' | tr '\n' ' ' | sed 's/ $//')
        [ -z "$IPV6_BLOCKS" ] && IPV6_BLOCKS="None"
        AUTO_ASSIGN=$(echo "$SUBNET_INFO" | jq -r '.AssignIpv6AddressOnCreation // "None"')
        VPC_ID=$(echo "$SUBNET_INFO" | jq -r '.VpcId // "None"')
    else
        IPV6_BLOCKS="None"; AUTO_ASSIGN="None"; VPC_ID="None"
    fi

    # 3. Fetch VPC details
    if [ "$VPC_ID" != "None" ]; then
        VPC_RAW=$(aws ec2 describe-vpcs --vpc-ids "$VPC_ID" --output json)
        VPC_IPV6=$(echo "$VPC_RAW" | jq -r '.Vpcs[0].Ipv6CidrBlockAssociationSet[]?.Ipv6CidrBlock' | tr '\n' ' ' | sed 's/ $//')
        [ -z "$VPC_IPV6" ] && VPC_IPV6="None"
    else
        VPC_IPV6="None"
    fi

    # 3.1 Fetch Networking Architecture details
    if [ "$SUBNET_ID" != "None" ]; then
        # Get route table (handles both explicit and main route table)
        ROUTE_TABLE_ID=$(aws ec2 describe-route-tables --filters "Name=association.subnet-id,Values=$SUBNET_ID" --query "RouteTables[0].RouteTableId" --output text 2>/dev/null)

        if [ "$ROUTE_TABLE_ID" = "None" ] || [ -z "$ROUTE_TABLE_ID" ]; then
            # Subnet uses main route table
            ROUTE_TABLE_ID=$(aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" "Name=association.main,Values=true" --query "RouteTables[0].RouteTableId" --output text 2>/dev/null)
        fi

        if [ "$ROUTE_TABLE_ID" != "None" ] && [ -n "$ROUTE_TABLE_ID" ]; then
            IPV6_ROUTE=$(aws ec2 describe-route-tables --route-table-ids "$ROUTE_TABLE_ID" --query "RouteTables[0].Routes[?DestinationIpv6CidrBlock=='::/0'].GatewayId" --output text 2>/dev/null)
            [ -z "$IPV6_ROUTE" ] && IPV6_ROUTE="MISSING"
        else
            IPV6_ROUTE="None"
        fi
    else
        ROUTE_TABLE_ID="None"; IPV6_ROUTE="None"
    fi

    if [ "$VPC_ID" != "None" ]; then
        IGW_ID=$(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query "InternetGateways[0].InternetGatewayId" --output text 2>/dev/null || echo "None")
    else
        IGW_ID="None"
    fi

    # 4. Print Report
    echo "---------------------------------------------------------"
    printf "%-18s : %s\n" "Instance Name" "$INSTANCE_NAME"
    printf "%-18s : %s\n" "Instance ID" "$INSTANCE_ID"
    printf "%-18s : %s\n" "Instance Type" "$INSTANCE_TYPE"
    printf "%-18s : %s\n" "Current AMI" "$CURRENT_AMI"
    printf "%-18s : %s\n" "Key Name" "$KEY_NAME"
    printf "%-18s : %s\n" "IAM Role (ARN)" "$IAM_ROLE"
    printf "%-18s : [%s]\n" "Security Groups" "$SECURITY_GROUPS"
    printf "%-18s : %s\n" "Current IPv6" "$CURRENT_IPV6"
    printf "%-18s : %s\n" "Placement Group" "$PLACEMENT_GROUP"
    printf "%-18s : %s\n" "Tenancy" "$TENANCY"
    printf "%-18s : %s\n" "Monitoring" "$MONITORING"
    echo "---------------------------------------------------------"
    printf "%-18s : %s\n" "VPC ID" "$VPC_ID"
    printf "%-18s : %s\n" "VPC IPv6 CIDR" "$VPC_IPV6"
    printf "%-18s : %s\n" "Internet Gateway" "$IGW_ID"
    printf "%-18s : %s\n" "Subnet ID" "$SUBNET_ID"
    printf "%-18s : %s\n" "Subnet IPv6 CIDR" "$IPV6_BLOCKS"
    printf "%-18s : %s\n" "Auto-assign IPv6" "$AUTO_ASSIGN"
    echo "---------------------------------------------------------"
    printf "%-18s : %s\n" "Route Table ID" "$ROUTE_TABLE_ID"
    printf "%-18s : %s\n" "IPv6 Default Rte" "$IPV6_ROUTE"
    echo "---------------------------------------------------------"
    
    if [ "$USER_DATA" != "None" ]; then
        echo "User Data:"
        echo "$USER_DATA" | sed 's/^/  /'
    else
        printf "%-18s : %s\n" "User Data" "None"
    fi
    echo "---------------------------------------------------------"
    # 5. EBS Configuration (Table Output)
    log_section "EBS Volume Details"
    VOL_IDS=$(echo "$INSTANCE_DETAILS" | jq -r '.BlockDeviceMappings[].Ebs.VolumeId' | tr '\n' ' ')
    if [ -n "$VOL_IDS" ]; then
        aws ec2 describe-volumes \
            --volume-ids $VOL_IDS \
            --query "Volumes[].[VolumeId,Size,VolumeType,Encrypted,Iops,Throughput]" \
            --output table
    else
        echo "No EBS volumes found."
    fi

    # 6. All Tags (Table Output)
    log_section "Instance Tags"
    aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --query "Reservations[0].Instances[0].Tags" \
        --output table
}

create_aws_instance() {
    log_section "AWS Account Cost Analysis (Month-to-Date)"
    aws ec2 run-instances \
    --image-id ami-0d08d877f9b675fc2 \
    --count 1 \
    --instance-type t4g.small \
    --key-name sn1 \
    --security-group-ids sg-08b8784e1d20ffb74 sg-009da64fca1267419 \
    --subnet-id subnet-09ed4253e35928268 \
    --iam-instance-profile Arn=arn:aws:iam::265098614515:instance-profile/EC2-SSM-Role \
    --associate-public-ip-address false \
    --ipv6-address-count 1 \
    --block-device-mappings '[{
        "DeviceName": "/dev/xvda",
        "Ebs": {
            "VolumeSize": 8,
            "VolumeType": "gp3",
            "Iops": 3000,
            "Throughput": 125,
            "DeleteOnTermination": true
        }
    }]' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=sanvasify-prod-new}]" 

}


# 3. Main Execution
# ---------------------------------------------------------
check_dependencies
#get_aws_costs
#create_aws_instance
get_infrastructure_details

echo -e "\n${GREEN}Discovery Complete.${NC}"