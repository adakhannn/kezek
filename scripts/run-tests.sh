#!/usr/bin/env bash
# Legacy seeded scenarios require an explicit, separately authorized isolated target.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/run-sql-tests.mjs"
