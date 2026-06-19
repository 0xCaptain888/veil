#!/usr/bin/env bash
# Veil — Devnet Reset Script
# Resets the devnet environment: rebuilds, redeploys, and creates sample recipients.
# Usage: ./scripts/reset-devnet.sh
#
# Prerequisites:
#   - Sui CLI installed and configured for devnet
#   - Active address has gas (run `sui client faucet` first)
#   - Node.js >= 20

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo " Veil — Devnet Reset"
echo "=========================================="

# Step 1: Switch to devnet
echo ""
echo "[1/6] Switching to devnet..."
sui client switch --env devnet 2>/dev/null || {
  echo "  Devnet env not found. Creating..."
  sui client new-env --alias devnet --rpc https://fullnode.devnet.sui.io:443
  sui client switch --env devnet
}
echo "  ✓ Switched to devnet"

# Step 2: Check gas
echo ""
echo "[2/6] Checking gas balance..."
ACTIVE_ADDR=$(sui client active-address)
echo "  Active address: $ACTIVE_ADDR"
sui client faucet
echo "  ✓ Faucet requested (wait ~30s for funds to arrive)"
sleep 5
sui client gas

# Step 3: Build Move package
echo ""
echo "[3/6] Building Move package..."
sui move build --path "$PROJECT_DIR/move/veil"
echo "  ✓ Build successful"

# Step 4: Run tests
echo ""
echo "[4/6] Running Move tests..."
sui move test --path "$PROJECT_DIR/move/veil"
echo "  ✓ All tests passed"

# Step 5: Deploy
echo ""
echo "[5/6] Deploying to devnet..."
echo "  Publishing package..."
PUBLISH_OUTPUT=$(sui client publish --gas-budget 500000000 "$PROJECT_DIR/move/veil" --json 2>/dev/null)

# Extract package ID
PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.type == "published") | .packageId' | head -1)
UPGRADE_CAP=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.type == "created") | select(.objectType | contains("UpgradeCap")) | .objectId' | head -1)

if [ -z "$PACKAGE_ID" ] || [ "$PACKAGE_ID" = "null" ]; then
  echo "  ✗ Failed to extract package ID. Raw output:"
  echo "$PUBLISH_OUTPUT"
  exit 1
fi

echo "  ✓ Package deployed!"
echo "  Package ID:  $PACKAGE_ID"
echo "  UpgradeCap:  $UPGRADE_CAP"

# Step 6: Update .env
echo ""
echo "[6/6] Updating environment configuration..."
ENV_FILE="$PROJECT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  # Update existing .env
  sed -i.bak "s|^VEIL_PACKAGE_ID=.*|VEIL_PACKAGE_ID=$PACKAGE_ID|" "$ENV_FILE"
  sed -i.bak "s|^NEXT_PUBLIC_VEIL_PACKAGE_ID=.*|NEXT_PUBLIC_VEIL_PACKAGE_ID=$PACKAGE_ID|" "$ENV_FILE"
  sed -i.bak "s|^SUI_NETWORK=.*|SUI_NETWORK=devnet|" "$ENV_FILE"
  echo "  ✓ Updated $ENV_FILE"
else
  echo "  ⚠ No .env file found. Copy .env.example and update manually:"
  echo "    cp .env.example .env"
  echo "    VEIL_PACKAGE_ID=$PACKAGE_ID"
fi

# Copy to relayer and web env
if [ -f "$PROJECT_DIR/apps/relayer/.env" ]; then
  sed -i.bak "s|^VEIL_PACKAGE_ID=.*|VEIL_PACKAGE_ID=$PACKAGE_ID|" "$PROJECT_DIR/apps/relayer/.env"
  sed -i.bak "s|^SUI_NETWORK=.*|SUI_NETWORK=devnet|" "$PROJECT_DIR/apps/relayer/.env"
fi

if [ -f "$PROJECT_DIR/apps/web/.env.local" ]; then
  sed -i.bak "s|^NEXT_PUBLIC_VEIL_PACKAGE_ID=.*|NEXT_PUBLIC_VEIL_PACKAGE_ID=$PACKAGE_ID|" "$PROJECT_DIR/apps/web/.env.local"
  sed -i.bak "s|^NEXT_PUBLIC_SUI_NETWORK=.*|NEXT_PUBLIC_SUI_NETWORK=devnet|" "$PROJECT_DIR/apps/web/.env.local"
fi

# Print sample recipients
echo ""
echo "=========================================="
echo " Devnet Reset Complete!"
echo "=========================================="
echo ""
echo " Package ID: $PACKAGE_ID"
echo " UpgradeCap: $UPGRADE_CAP"
echo ""
echo " Sample recipients for demo:"
echo "   1. alice@example.com   — 100 SUI"
echo "   2. bob@startup.io      — 250 SUI"
echo "   3. carol@dao.org       — 175 SUI"
echo "   4. dave@agency.co      — 320 SUI"
echo ""
echo " Next steps:"
echo "   1. Ensure RELAYER_PRIVATE_KEY is set in .env (funded on devnet)"
echo "   2. npm run dev:relayer   (terminal A)"
echo "   3. npm run dev:web       (terminal B)"
echo "   4. Open http://localhost:3000/employer"
echo ""
