#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="purchess_${TIMESTAMP}.dump"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${R2_BUCKET:?R2_BUCKET is required}"
: "${R2_ENDPOINT:?R2_ENDPOINT is required}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"

echo "[backup] Starting backup at ${TIMESTAMP}"

pg_dump --format=custom --no-acl --no-owner "${DATABASE_URL}" > "/tmp/${BACKUP_FILE}"

gzip "/tmp/${BACKUP_FILE}"

echo "[backup] Uploading ${COMPRESSED_FILE} to R2"

AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
  aws s3 cp \
    "/tmp/${COMPRESSED_FILE}" \
    "s3://${R2_BUCKET}/daily/${COMPRESSED_FILE}" \
    --endpoint-url "${R2_ENDPOINT}" \
    --no-progress

rm -f "/tmp/${COMPRESSED_FILE}"

echo "[backup] Done: s3://${R2_BUCKET}/daily/${COMPRESSED_FILE}"

AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
  aws s3 ls "s3://${R2_BUCKET}/daily/" \
    --endpoint-url "${R2_ENDPOINT}" \
  | sort -k1,2 \
  | head -n -30 \
  | awk '{print $4}' \
  | while read -r old_file; do
      echo "[backup] Pruning old backup: ${old_file}"
      AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
      AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
        aws s3 rm "s3://${R2_BUCKET}/daily/${old_file}" \
          --endpoint-url "${R2_ENDPOINT}"
    done

echo "[backup] Complete"
