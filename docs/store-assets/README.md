# Play Store graphic assets

Generated 2026-07-28, ready for upload.

- `hi-res-icon-512.png` - 512x512, 32-bit PNG. Copy of `app/public/favicon.png`
  (the same Om+flame icon used as the app's actual launcher icon), which was
  already exactly 512x512 - no upscaling needed.
- `feature-graphic.png` - 1024x500, 24-bit PNG (no alpha). Built from the
  app's real brand assets: the transparent adaptive-icon foreground layer
  (`app/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png`),
  the `wordmark-ondark.png` wordmark, the app's actual saffron-950 to
  saffron-700 gradient (`linear-gradient(160deg, #431407, #7C2D12 55%,
  #C2410C)`, same one used on the referral/hall-banner cards), and the Sora /
  DM Sans self-hosted fonts - rendered via a local HTML page screenshotted at
  the exact 1024x500 target size, so nothing was hand-drawn or invented.

Both are final-format (correct dimensions, correct alpha/no-alpha per Play's
spec) and ready to upload as-is. If the logo/wordmark changes later (see the
open logo-redesign notes), regenerate the feature graphic from the same HTML
approach - the source lives in the session scratchpad, not committed here;
ask for it to be rebuilt if needed.
