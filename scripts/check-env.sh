#!/usr/bin/env bash
set -euo pipefail

ENV_EXAMPLE="${1:-.env.example}"
ENV_FILE="${2:-.env}"

if [[ ! -f "$ENV_EXAMPLE" ]]; then
  echo "ERROR: $ENV_EXAMPLE not found" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy $ENV_EXAMPLE to $ENV_FILE and fill in values." >&2
  exit 1
fi

missing=()

while IFS= read -r line; do
  if [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)=(.+)$ ]]; then
    key="${BASH_REMATCH[1]}"
    if ! grep -q "^${key}=.\+" "$ENV_FILE" 2>/dev/null; then
      missing+=("$key")
    fi
  fi
done < "$ENV_EXAMPLE"

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: Missing required env vars in $ENV_FILE:" >&2
  for key in "${missing[@]}"; do
    echo "  - $key" >&2
  done
  exit 1
fi

echo "OK: All required env vars present in $ENV_FILE"
