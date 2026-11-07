#!/bin/bash
input=$(cat)

# Avoid an endless loop: if Claude is already retrying because of this hook, let it stop
if [ "$(echo "$input" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Skip when nothing in frontend/src has changed
if [ -z "$(git status --porcelain -- frontend/src)" ]; then
  exit 0
fi

if ! out=$(pnpm check:fsd 2>&1); then
  echo "FSD architecture check failed. Fix these violations before finishing:" >&2
  echo "$out" >&2
  exit 2   # exit 2 = block stopping and send the error text back to Claude
fi
exit 0
