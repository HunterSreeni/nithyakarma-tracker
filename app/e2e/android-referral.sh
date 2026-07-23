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
# the on-screen keyboard's page-scroll amount is not reliably reproducible
# run to run, so hardcoded coordinates for the password field / Sign In
# button are inherently flaky - two miscalibrated attempts landed on a real
# personal Google account cached on this emulator instead of the throwaway
# account (confirmed via Supabase MCP both times that no data was written to
# it). Fixed properly: after the one coordinate-based tap to focus the email
# field, use KEYCODE_TAB to move focus to the password field and
# KEYCODE_ENTER to submit - both are DOM focus-order operations, immune to
# the keyboard-reflow problem.
tap 557 1562             # email field (the only coordinate-based tap for login)
sleep 1
adb shell input text "$EMAIL"
sleep 1
adb shell input keyevent KEYCODE_TAB     # move focus to the password field
sleep 1
adb shell input text "$PASSWORD"
sleep 1
adb shell input keyevent KEYCODE_ENTER   # submit
sleep 5
shot "01-onboard-intro.png"

echo "==> 4. Onboarding: Get started -> fill form -> enter referral code"
# Coordinates re-measured and verified 2026-07-23 (this whole onboarding
# section had never actually been run before - the form is NOT scrolled by
# the keyboard the way the login screen is, so these are stable no-keyboard
# positions throughout).
tap 540 1781              # Get started
sleep 2
adb shell input text "Android%sReferral"      # %s = space (adb input text quirk) -
                                               # NOTE: this quirk is unreliable in
                                               # practice (still produced "Android" with
                                               # the space/second word dropped in testing);
                                               # harmless since the name isn't asserted on,
                                               # but don't rely on it if the name ever matters.
sleep 1
tap 324 1215               # Male (adds the Sandhyavandhanam hint, shifts layout below)
sleep 1
tap 540 1572                # referral code field (post-shift position)
sleep 1
adb shell input text "$REFERRER_CODE"
sleep 1
shot "02-onboard-filled.png"
tap 540 1631                 # Begin
sleep 5

echo "==> 5. Dismiss the notification prompt (real one - this account has never onboarded before) and the guided tour"
tap 540 1506              # "Maybe later" on the "Turn on reminders?" prompt (this is the
                           # genuine first-onboarding case the prompt is meant for)
sleep 2
tap 842 1348               # tour step 1/3: Next
sleep 1
tap 917 1873               # tour step 2/3: Next
sleep 1
tap 836 1287               # tour step 3/3: Begin
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
