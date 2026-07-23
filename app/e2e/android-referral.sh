#!/usr/bin/env bash
# Android referral E2E: build -> install -> sign up a fresh (non-onboarded)
# account -> manually enter a referrer's code in onboarding (Android has no
# ?ref= deep link like the web app) -> assert no crash via logcat + a final
# screenshot. Full state (referrals row + ad_free_until) is cross-checked
# separately via Supabase MCP against the same account.
#
# The in-app WebView exposes no accessibility tree (NAF="true"), so this is
# screenshot-then-adb-tap, same technique as android-sandhya.sh. Coordinates
# are calibrated for a 1080x2400 emulator and WILL need recalibrating on a
# different resolution - see TEST-PLAN.md's Android tooling notes.
#
# Requires: a running emulator/device (adb), JDK for Gradle, app/.env present,
# and the throwaway account seeded first via Supabase MCP:
#   supabase/tests/seed-android-referral-throwaway.sql
# and a referrer code passed as $1 (e.g. the e2e@nithyakarma.test account's
# referral_code, looked up via Supabase MCP).
#
# Usage: JAVA_HOME=/path/to/jdk21 ./e2e/android-referral.sh <referrer_code>
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG="org.nithyakarma.app"
APK="$APP_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
SCRATCH="$(mktemp -d)"
EMAIL="android-referral-throwaway@nithyakarma.test"
PASSWORD="AndroidReferral2026xyz"
REFERRER_CODE="${1:?usage: android-referral.sh <referrer_code>}"
cd "$APP_DIR"

tap() { adb shell input tap "$1" "$2"; }
shot() { adb exec-out screencap -p > "$SCRATCH/$1"; }

echo "==> 0. Preconditions"
[ -f .env ] || { echo "FAIL: app/.env missing - build would white-screen"; exit 1; }
adb get-state >/dev/null 2>&1 || { echo "FAIL: no adb device/emulator"; exit 1; }

echo "==> 1. Build web + sync + assemble debug APK"
npm run build >/dev/null
npx cap sync android >/dev/null
( cd android && ./gradlew --console=plain assembleDebug >/dev/null )

echo "==> 2. Install + launch (fresh app data - this account isn't pre-onboarded)"
adb shell pm clear "$PKG" >/dev/null || true
sleep 2
adb install -r "$APK" >/dev/null
adb logcat -c
adb shell am start -n "$PKG/.MainActivity" >/dev/null
sleep 8

echo "==> 3. Log in"
# NOTE (found + fixed 2026-07-23, see android-sandhya.sh for the full story):
# tapping the email field brings up the on-screen keyboard, which scrolls the
# page up to keep the focused field visible - the password/Sign In taps need
# the keyboard-shown coordinates below, not the no-keyboard ones the first
# tap uses. The onboarding form taps further down (name/referral-code fields)
# likely have the same keyboard-scroll issue and were NOT re-verified against
# a real run in this session - re-check interactively before trusting this
# script's PASS.
tap 557 1562            # email field (no keyboard shown yet)
sleep 1
adb shell input text "$EMAIL"
sleep 1
tap 540 954              # password field (keyboard now shown, page scrolled up)
sleep 1
adb shell input text "$PASSWORD"
sleep 1
tap 540 1214              # Sign In (keyboard-shown position)
sleep 5
shot "01-onboard-intro.png"

echo "==> 4. Onboarding: Get started -> fill form -> enter referral code"
tap 540 1781              # Get started
sleep 2
adb shell input text "Android%sReferral"      # %s = space (adb input text quirk)
sleep 1
tap 324 1231               # Male (adds the Sandhyavandhanam hint, shifts layout below)
sleep 1
tap 540 1535                # referral code field (post-shift position)
sleep 1
adb shell input text "$REFERRER_CODE"
sleep 1
adb shell input keyevent KEYCODE_BACK
sleep 1
shot "02-onboard-filled.png"
tap 540 1675                 # Begin
sleep 5

echo "==> 5. Dismiss OS notification prompt + guided tour (no-ops if absent)"
tap 540 1470              # "Don't allow" on the OS notification dialog
sleep 1
tap 950 1085               # close "x" on the driver.js tour popover
sleep 1
shot "03-today.png"

echo "==> 6. Assertions"
fail=0
LOG="$(adb logcat -d 2>&1)"
if echo "$LOG" | grep -qiE "AndroidRuntime: FATAL"; then
  echo "  FAIL: fatal crash during referral flow"; fail=1
else
  echo "  ok: no fatal crash"
fi
adb shell pidof "$PKG" >/dev/null && echo "  ok: process alive" || { echo "  FAIL: process not running"; fail=1; }
echo "  screenshots saved to $SCRATCH (03-today.png should show 'Namaskaram, Android')"
echo "  cross-check the referrals row + ad_free_until via Supabase MCP against $EMAIL, then delete the throwaway user"

[ "$fail" = 0 ] && echo "ANDROID REFERRAL E2E: PASS" || { echo "ANDROID REFERRAL E2E: FAIL"; exit 1; }
