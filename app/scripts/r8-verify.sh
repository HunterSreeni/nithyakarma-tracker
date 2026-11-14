#!/usr/bin/env bash
# Usage: scripts/r8-verify.sh <app-release.apk|app-release.aab>   (run from app/)
# Dumps the DEX that actually ships and runs scripts/r8-check.mjs against it and
# R8's mapping.txt. Exit 1 = a Capacitor bridge class/method was renamed or
# stripped, or obfuscation did not happen.
set -euo pipefail
ARTIFACT="$1"
MAPPING=android/app/build/outputs/mapping/release/mapping.txt
[ -f "$MAPPING" ] || { echo "::error::$MAPPING not found - was minifyEnabled on?"; exit 1; }
DEXDUMP=$(ls -d "$ANDROID_HOME"/build-tools/*/dexdump | sort -V | tail -1)
WORK=$(mktemp -d)
unzip -q -o "$ARTIFACT" '*.dex' -d "$WORK"
: > "$WORK/dexdump.txt"
find "$WORK" -name '*.dex' | sort | while read -r dex; do "$DEXDUMP" "$dex" >> "$WORK/dexdump.txt"; done
node scripts/r8-check.mjs --mapping="$MAPPING" --dexdump="$WORK/dexdump.txt"
