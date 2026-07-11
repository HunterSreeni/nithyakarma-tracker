#!/usr/bin/env bash
# Android smoke test: build -> install -> launch -> assert the web layer boots
# inside the Capacitor shell (the failure mode that shipped as a white screen).
# Requires: a running emulator/device (adb), JDK for Gradle, app/.env present.
#
# Usage: JAVA_HOME=/path/to/jdk21 ./e2e/android-smoke.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG="in.co.sreeniverse.nithyakarma"
APK="$APP_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
cd "$APP_DIR"

echo "==> 0. Preconditions"
[ -f .env ] || { echo "FAIL: app/.env missing - build would white-screen"; exit 1; }
adb get-state >/dev/null 2>&1 || { echo "FAIL: no adb device/emulator"; exit 1; }

echo "==> 1. Build web + sync + assemble debug APK"
npm run build >/dev/null
npx cap sync android >/dev/null
( cd android && ./gradlew --console=plain assembleDebug >/dev/null )

echo "==> 2. Install"
adb install -r "$APK" >/dev/null

echo "==> 3. Launch and capture logcat"
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 6
LOG="$(adb logcat -d 2>&1)"

echo "==> 4. Assertions"
fail=0
echo "$LOG" | grep -q "Loading app at https://localhost" \
  && echo "  ok: Capacitor loaded the web app" || { echo "  FAIL: web app never loaded"; fail=1; }
echo "$LOG" | grep -q "Handling local request: https://localhost/assets/" \
  && echo "  ok: JS/CSS assets served" || { echo "  FAIL: bundle assets not served (bad build/env?)"; fail=1; }
if echo "$LOG" | grep -qiE "AndroidRuntime: FATAL|Supabase env missing"; then
  echo "  FAIL: fatal error or missing-env guard tripped"; fail=1
else
  echo "  ok: no fatal crash / env guard"
fi
adb shell pidof "$PKG" >/dev/null && echo "  ok: process alive" || { echo "  FAIL: process not running"; fail=1; }

[ "$fail" = 0 ] && echo "ANDROID SMOKE: PASS" || { echo "ANDROID SMOKE: FAIL"; exit 1; }
