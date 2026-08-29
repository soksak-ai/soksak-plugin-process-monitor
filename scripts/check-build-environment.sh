#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
expected_node=$(awk 'NF { value=$0; count++ } END { if (count == 1) print value; else exit 1 }' "$root/.node-version")
actual_node=$(node -p 'process.versions.node')
[ "$actual_node" = "$expected_node" ] || { echo "TOOLCHAIN_MISMATCH node required=$expected_node actual=$actual_node" >&2; exit 78; }
expected_pnpm=$(node -p 'require(process.argv[1]).packageManager.split("@")[1]' "$root/package.json")
actual_pnpm=$(pnpm --version)
[ "$actual_pnpm" = "$expected_pnpm" ] || { echo "TOOLCHAIN_MISMATCH pnpm required=$expected_pnpm actual=$actual_pnpm" >&2; exit 78; }
printf 'BUILD_ENVIRONMENT_READY node=%s pnpm=%s runtime=%s/%s\n' "$actual_node" "$actual_pnpm" "$(node -p 'process.platform')" "$(node -p 'process.arch')"
