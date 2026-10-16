#!/usr/bin/env bash
set -u

cd "$(dirname "$0")/.."

shopt -s nullglob
zips=(*.zip)

if (( ${#zips[@]} == 0 )); then
  echo "No .zip files found in $(pwd)"
  exit 0
fi

ok=0
failed=0

for zip in "${zips[@]}"; do
  echo "========================================"
  echo "Extracting: $zip"
  if unzip -o "$zip"; then
    echo "OK: $zip"
    ((ok++))
  else
    echo "FAILED: $zip"
    ((failed++))
  fi
done

echo "========================================"
echo "Done. Extracted: $ok  Failed: $failed"

if (( failed > 0 )); then
  exit 1
fi
