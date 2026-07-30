#!/usr/bin/env bash
set -euo pipefail

: "${STAGING_API_URL:?STAGING_API_URL is required}"
: "${STAGING_ACCESS_TOKEN:?STAGING_ACCESS_TOKEN is required}"
: "${STAGING_REFRESH_TOKEN:?STAGING_REFRESH_TOKEN is required}"

device_id="${FLUTTER_DEVICE_ID:-emulator-5554}"
define_file="$(mktemp "${TMPDIR:-/tmp}/aipod-staging-defines.XXXXXX.json")"
trap 'rm -f "$define_file"' EXIT

STAGING_DEFINE_FILE="$define_file" node <<'NODE'
const fs = require('fs');

const values = {
  STAGING_API_URL: process.env.STAGING_API_URL,
  STAGING_ACCESS_TOKEN: process.env.STAGING_ACCESS_TOKEN,
  STAGING_REFRESH_TOKEN: process.env.STAGING_REFRESH_TOKEN,
};

fs.writeFileSync(process.env.STAGING_DEFINE_FILE, JSON.stringify(values));
NODE

flutter test integration_test/auth_refresh_test.dart \
  -d "$device_id" \
  --dart-define-from-file="$define_file"
