# AWS Cost Comparison: March 2026 vs April 2026

## Total Cost Summary
| Month | Total Cost | Status |
|-------|------------|---------|
| **March 2026** | **$5.47** | Complete month |
| **April 2026** | **$2.51** | Partial (Apr 1-15 only) |

## Detailed Service Breakdown with VPC Components

| Service | March 2026 | April 2026 (Partial) | Difference | % Change |
|---------|------------|---------------------|------------|----------|
| **Amazon VPC** | **$3.72** | **$1.69** | **-$2.03** | **-54.6%** |
| └── Public IPv4 - In-Use Address | $3.72 | $1.68 | -$2.04 | -54.8% |
| └── Public IPv4 - Idle Address | $0.00 | $0.01 | +$0.01 | New |
| └── NAT Gateway | $0.00 | $0.00 | $0.00 | — |
| └── VPN Connections | $0.00 | $0.00 | $0.00 | — |
| └── VPC Endpoints | $0.00 | $0.00 | $0.00 | — |
| └── Data Transfer | $0.00 | $0.00 | $0.00 | — |
| **EC2 - Other** | $0.92 | $0.44 | -$0.48 | -52.4% |
| **Tax** | $0.83 | $0.38 | -$0.45 | -54.2% |
| **Amazon S3** | $0.0002 | $0.0001 | -$0.0001 | -64.8% |
| **Other Services** | <$0.0001 | $0.00 | — | — |

## Amazon VPC Cost Analysis

### March 2026:
- **100% Public IPv4 In-Use Address charges** ($3.72)
- Approximately **10-11 public IPv4 addresses** actively attached to resources

### April 2026 (Partial):
- **99.3% Public IPv4 In-Use Address charges** ($1.68)
- **0.7% Public IPv4 Idle Address charges** ($0.01) - likely your Elastic IP before disallocation

## Key Findings:
1. **No NAT Gateway, VPN, or VPC Endpoint charges** under Amazon VPC service
2. **All VPC costs are from Public IPv4 address fees** ($0.005/hour per address)
3. **Your Elastic IP disallocation** eliminated the idle address charge going forward
4. **You still have ~10-11 public IPv4 addresses** attached to running resources

**Note:** NAT Gateway or other infrastructure costs may appear under "EC2 - Other" service instead of "Amazon VPC" in AWS billing.


# AWS Cost Comparison: March 2026 vs April 2026 vs May 2026 (Corrected)

## Total Cost Summary
| Month | Total Cost | Status |
|-------|------------|---------|
| **March 2026** | **$5.47** | Complete month |
| **April 2026** | **$5.29** | Complete month (Actual) |
| **May 2026** | **$1.66** | **Corrected Projection (IPv6-only)** |

## Detailed Service Breakdown - Corrected for IPv6-Only Setup

| Service | March 2026 | April 2026 (Actual) | May 2026 (Corrected) | Expected Change |
|---------|------------|---------------------|---------------------|-----------------|
| **Amazon VPC** | **$3.72** | **$3.63** | **$0.00** | **-$3.63 (100% reduction)** |
| └── Public IPv4 - In-Use Address | $3.72 | $3.62 | **$0.00** | **Eliminated** |
| └── Public IPv4 - Idle Address | $0.00 | $0.01 | **$0.00** | **Eliminated** |
| **EC2 - Other** | $0.92 | $0.84 | **$0.84** | No change expected |
| **Tax** | $0.83 | $0.82 | **$0.82** | Proportional to total |
| **Amazon S3** | $0.0002 | $0.0001 | **$0.0001** | No change expected |

## Current Configuration Verification ✅

**Your EC2 Instance (i-0f1830503a03f6307):**
- **Public IPv4**: None ❌
- **IPv6**: 2406:da1a:5e:0:7e64:c4a0:6ed6:9c12 ✅
- **Elastic IPs**: None allocated ✅

## Billing Discrepancy Alert ⚠️

**Issue**: Your April 2026 billing shows $3.63 in VPC charges for public IPv4 addresses, but your current resources show **zero public IPv4 addresses**.

**Possible Explanations**:
1. **Timing**: You may have transitioned to IPv6-only **after** April billing period
2. **Delayed billing**: AWS may still be processing the IPv4 address releases
3. **Other regions**: Public IPv4 addresses might exist in other AWS regions

**Corrected May 2026 Projection**: **$1.66 total** (69% cost reduction)
- VPC charges: $0.00 (no public IPv4 addresses)
- EC2-Other: ~$0.84 (unchanged)
- Tax: ~$0.82 (proportional)

## Recommendations:
1. **Verify billing period**: Check if IPv4 transition happened mid-April
2. **Check all regions**: Ensure no public IPv4 addresses exist in other regions
3. **Monitor May billing**: Confirm VPC charges drop to $0.00 in May

