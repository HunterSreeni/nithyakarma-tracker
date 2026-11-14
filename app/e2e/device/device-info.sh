#!/usr/bin/env bash
# Read-only device profile for physical-device testing (run with the phone on USB,
# USB debugging allowed). Prints what decides whether the app can run: Android
# version, WebView provider + version (the Capacitor app renders in it), Play
# services, screen, memory, and the installed Nithyakarma build. Changes nothing.
set -uo pipefail
ADB="${ADB:-$LOCALAPPDATA/Android/Sdk/platform-tools/adb}"
[ -x "$ADB" ] || ADB=adb
S="${1:-}"; [ -n "$S" ] && ADB="$ADB -s $S"
p() { $ADB shell getprop "$1" 2>/dev/null | tr -d '\r'; }
pkgver() { $ADB shell dumpsys package "$1" 2>/dev/null | tr -d '\r' | grep -m1 -E "versionName=" | sed 's/^ *//'; }

echo "== Device"
echo "model:        $(p ro.product.manufacturer) $(p ro.product.model) ($(p ro.product.device))"
echo "android:      $(p ro.build.version.release) (SDK $(p ro.build.version.sdk)), security patch $(p ro.build.version.security_patch)"
echo "android go:   $(p ro.config.low_ram) (true = Android Go / low-RAM device)"
echo "build:        $(p ro.build.display.id)"
echo "abi:          $(p ro.product.cpu.abilist)"
echo "locale / tz:  $(p persist.sys.locale) / $(p persist.sys.timezone)"
echo "memory:       $($ADB shell cat /proc/meminfo 2>/dev/null | tr -d '\r' | grep -m1 MemTotal)"
echo "screen:       $($ADB shell wm size 2>/dev/null | tr -d '\r' | tail -1), $($ADB shell wm density 2>/dev/null | tr -d '\r' | tail -1)"

echo "== WebView (what the app runs in)"
$ADB shell dumpsys webviewupdate 2>/dev/null | tr -d '\r' | grep -E "Current WebView package|Valid package|Preferred WebView package|Fallback logic" | sed 's/^ *//' | head -8
for pkg in com.google.android.webview com.android.webview com.android.chrome com.google.android.trichromelibrary; do
  v=$(pkgver $pkg); [ -n "$v" ] && echo "$pkg: $v"
done

echo "== Google Play services / Store"
echo "com.google.android.gms: $(pkgver com.google.android.gms)"
echo "com.android.vending:    $(pkgver com.android.vending)"

echo "== Nithyakarma"
$ADB shell dumpsys package org.nithyakarma.app 2>/dev/null | tr -d '\r' | grep -E "versionName=|versionCode=|firstInstallTime=|lastUpdateTime=|installerPackageName=|flags=\[" | sed 's/^ *//' | head -8
[ -n "$($ADB shell pm list packages org.nithyakarma.app 2>/dev/null)" ] || echo "(not installed)"
