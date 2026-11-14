# Project R8 rules. Capacitor's own consumer rules (from capacitor-android) keep
# @CapacitorPlugin classes, @PluginMethod methods and Plugin subclasses; AGP's
# default proguard-android.txt keeps @JavascriptInterface methods. Only add a rule
# here when scripts/r8-check.mjs or the on-device pass proves it is needed.

# Readable crash stack traces in Play Console / Android vitals (R8 maps them back
# using the mapping.txt bundled in the AAB).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
