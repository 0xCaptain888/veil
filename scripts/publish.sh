#!/usr/bin/env bash
set -euo pipefail
# Publish the Veil Move package and print the package id.
# Usage: ./scripts/publish.sh [gas-budget]
GAS_BUDGET="${1:-100000000}"
echo "Building & publishing veil Move package..."
sui move build --path move/veil
sui client publish --gas-budget "$GAS_BUDGET" move/veil
echo ""
echo "Copy the 'PackageID' from the 'Published Objects' section above into:"
echo "  .env                -> VEIL_PACKAGE_ID and NEXT_PUBLIC_VEIL_PACKAGE_ID"
