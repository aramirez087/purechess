#!/usr/bin/env bash
set -euo pipefail

: "${SENTRY_AUTH_TOKEN:?SENTRY_AUTH_TOKEN is required}"
: "${SENTRY_ORG:?SENTRY_ORG is required}"
: "${SENTRY_PROJECT:?SENTRY_PROJECT is required}"

DIST_DIR="${1:-.next}"

echo "Uploading source maps from ${DIST_DIR} to Sentry..."

npx @sentry/cli sourcemaps inject --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" "$DIST_DIR"
npx @sentry/cli sourcemaps upload --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" "$DIST_DIR"

echo "Source maps uploaded successfully."
