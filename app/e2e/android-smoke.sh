#!/usr/bin/env bash
# Android smoke test: build -> install -> launch -> assert the web layer boots
# inside the Capacitor shell (the failure mode that shipped as a white screen).
# Requires: a running emulator/device (adb), JDK for Gradle, app/.env present.
#
# Usage: JAVA_HOME=/path/to/jdk21 ./e2e/android-smoke.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG="org.nithyakarma.app"
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
SCRATCH="$(mktemp -d)"
adb exec-out screencap -p > "$SCRATCH/boot.png"

echo "==> 4. Assertions"
fail=0
# capacitor.config.ts sets loggingBehavior:'none' (2026-07-19, a deliberate
# security fix - the 'debug' default echoed OAuth tokens to logcat). That also
# silences the "Loading app at..."/"Handling local request..." bridge trace
# lines this script used to grep for, so a boot screenshot is the load signal
# now - see "$SCRATCH/boot.png" (should show the auth screen, not white/blank).
if echo "$LOG" | grep -qiE "AndroidRuntime: FATAL|Supabase env missing"; then
  echo "  FAIL: fatal error or missing-env guard tripped"; fail=1
else
  echo "  ok: no fatal crash / env guard"
fi
adb shell pidof "$PKG" >/dev/null && echo "  ok: process alive" || { echo "  FAIL: process not running"; fail=1; }
echo "  boot screenshot saved to $SCRATCH/boot.png - confirm it shows the app, not a blank/white screen"

[ "$fail" = 0 ] && echo "ANDROID SMOKE: PASS (verify boot.png manually)" || { echo "ANDROID SMOKE: FAIL"; exit 1; }
