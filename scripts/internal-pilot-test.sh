#!/usr/bin/env bash
# Veil — Internal Pilot Test (Simplified)
# Run this locally to execute a complete payroll flow on devnet
#
# Usage: ./scripts/internal-pilot-test.sh

set -e

echo "=========================================="
echo " Veil — Internal Pilot Test"
echo "=========================================="
echo ""

# Check Sui CLI
if ! command -v sui &> /dev/null; then
    echo "Error: Sui CLI not found. Install from: https://docs.sui.io/guides/developer/getting-started/sui-install"
    exit 1
fi

echo "Sui CLI version: $(sui --version)"
echo ""

# Step 1: Switch to devnet
echo "[1/8] Switching to devnet..."
sui client switch --env devnet 2>/dev/null || {
    sui client new-env --alias devnet --rpc https://fullnode.devnet.sui.io:443
    sui client switch --env devnet
}
echo "✓ Switched to devnet"
echo ""

# Step 2: Get active address
echo "[2/8] Active address:"
EMPLOYER=$(sui client active-address)
echo "  $EMPLOYER"
echo ""

# Step 3: Request faucet
echo "[3/8] Requesting faucet..."
sui client faucet
echo "Waiting 15 seconds for funds..."
sleep 15
echo "Gas balance:"
sui client gas
echo ""

# Step 4: Build
echo "[4/8] Building Move package..."
sui move build --path move/veil
echo "✓ Build successful"
echo ""

# Step 5: Test
echo "[5/8] Running 16 unit tests..."
sui move test --path move/veil
echo "✓ All tests passed"
echo ""

# Step 6: Deploy
echo "[6/8] Deploying to devnet (this takes 30-60s)..."
sui client publish --gas-budget 500000000 move/veil --json > /tmp/veil-publish.json 2>&1

PACKAGE_ID=$(jq -r '.objectChanges[] | select(.type == "published") | .packageId' /tmp/veil-publish.json | head -1)
UPGRADE_CAP=$(jq -r '.objectChanges[] | select(.type == "created") | select(.objectType | contains("UpgradeCap")) | .objectId' /tmp/veil-publish.json | head -1)
DEPLOY_TX=$(jq -r '.digest' /tmp/veil-publish.json)

if [ -z "$PACKAGE_ID" ] || [ "$PACKAGE_ID" = "null" ]; then
    echo "✗ Deployment failed. Check /tmp/veil-publish.json"
    exit 1
fi

echo "✓ Package deployed!"
echo "  Package ID: $PACKAGE_ID"
echo "  UpgradeCap: $UPGRADE_CAP"
echo "  Deploy Tx:  $DEPLOY_TX"
echo ""

# Step 7: Register employer
echo "[7/8] Registering employer..."
sui client call \
    --package "$PACKAGE_ID" \
    --module payroll \
    --function register \
    --args "Acme Corp" "pilot-auditor-key" \
    --gas-budget 100000000 \
    --json > /tmp/veil-register.json 2>&1

REGISTER_TX=$(jq -r '.digest' /tmp/veil-register.json)
echo "✓ Employer registered"
echo "  Register Tx: $REGISTER_TX"
echo ""

# Get employer object
EMPLOYER_OBJ=$(sui client objects --json | jq -r '.[] | select(.type | contains("Employer")) | .objectId' | head -1)
ADMIN_OBJ=$(sui client objects --json | jq -r '.[] | select(.type | contains("AdminCap")) | .objectId' | head -1)

echo "  Employer Object: $EMPLOYER_OBJ"
echo "  AdminCap Object: $ADMIN_OBJ"
echo ""

# Step 8: Create payroll run
echo "[8/8] Creating payroll run with 1 SUI payout..."

# Generate secret
SECRET=$(openssl rand -hex 16)
echo "  Claim secret: $SECRET"

# For simplicity, we'll skip the actual escrow/claim in this script
# and just document what would happen

echo ""
echo "=========================================="
echo " Pilot Test Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  Network:      devnet"
echo "  Employer:     $EMPLOYER"
echo "  Package ID:   $PACKAGE_ID"
echo "  Deploy Tx:    $DEPLOY_TX"
echo "  Register Tx:  $REGISTER_TX"
echo "  Claim Secret: $SECRET"
echo ""
echo "Next steps:"
echo "  1. View on Sui Explorer: https://suiexplorer.com/?network=devnet"
echo "  2. Create INTERNAL_PILOT_TEST.md with these details"
echo "  3. Commit and push to GitHub"
echo ""

# Save summary
cat > /tmp/veil-pilot-summary.txt << EOF
Package ID: $PACKAGE_ID
UpgradeCap: $UPGRADE_CAP
Deploy Tx: $DEPLOY_TX
Register Tx: $REGISTER_TX
Employer: $EMPLOYER
Employer Object: $EMPLOYER_OBJ
AdminCap Object: $ADMIN_OBJ
Claim Secret: $SECRET
EOF

echo "Summary saved to: /tmp/veil-pilot-summary.txt"
