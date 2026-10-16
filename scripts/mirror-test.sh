#!/usr/bin/env bash
# Run tests/typecheck in a Linux mirror outside the repo, leaving the repo's
# macOS node_modules alone. Used by the agent shell on this machine; on macOS
# just run `pnpm test` / `pnpm typecheck` directly.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DST="${MIRROR_DIR:-$HOME/work/mirror}"
mkdir -p "$DST"
rsync -a --delete \
  --exclude node_modules --exclude .git --exclude dist --exclude dist-types \
  --exclude 'tests/out' --exclude '*.tsbuildinfo' \
  "$SRC/" "$DST/"
cd "$DST"
[ -d node_modules ] || npm_config_registry=https://registry.npmjs.org npx --yes pnpm@10.28.0 install --frozen-lockfile >/dev/null
npx pnpm vitest run "$@"
npx pnpm tsc -b
echo "mirror OK"
