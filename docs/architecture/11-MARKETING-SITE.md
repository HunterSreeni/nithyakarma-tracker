# 11 - Marketing Site (`/site`)

Built 20 July 2026, deployed 22 July 2026, custom domain live 23 July 2026. A static
(non-SPA) marketing site for the `nithyakarma.org` root domain, entirely separate from
the React app in `/app`. Runs on its own Netlify project (`tranquil-jalebi-88d0eb`),
reachable at both `https://nithyakarma.org` and `https://tranquil-jalebi-88d0eb.netlify.app/`.
`app.nithyakarma.org` for the React app itself is a separate, still-open cutover - see
`docs/ROADMAP.md`'s "Domain and public identity" section for that checklist.

## Pages

| File | Purpose |
|---|---|
| `site/index.html` | About/landing - adapted from the app's `/about` copy, plus platform badges |
| `site/karma.html` | Punya/tier/streak explainer - adapted from the app's `/karma` copy, with `FAQPage` JSON-LD |
| `site/support.html` | "Support us" - goodwill asks only (rate, share, feedback), no payment/donation |

Shared nav/footer is duplicated across all three files - deliberately no templating,
since introducing a build step for 3 static pages would be the wrong tradeoff.

## Why static, not the React app extended

AI crawlers (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot) mostly don't execute
JavaScript - they read raw HTML. A client-rendered SPA delivers an empty shell to
them; a static site is fully visible to both classic SEO and AI answer-engine
citation (GEO/AIO). This applies to organic search too, not just AI.

## Brand tokens - matched exactly, not reinvented

Pulled directly from `app/src/index.css` (the real tokens; `app/src/App.css`'s
`--accent` variable is dead Vite boilerplate, ignore it):

- Accent: `--action: #C2410C` (burnt-orange/saffron), ramp `--saffron-50` through `-950`
- Neutrals: warm-toned scale, `--paper: #f5f0e8`, `--ink: #0d0d0d`, `--border: #ede8dc`
- Body: **DM Sans**. Headings: **Sora**. Wordmark: **Yatra One** (single weight 400)
- All three self-hosted as `.woff2` in `site/fonts/` (same files as `app/public/fonts/`),
  because nothing here should depend on Google Fonts CDN availability

### Wordmark font status: placeholder, not final

**Yatra One is a placeholder**, not the finished decision. It was originally believed
to have a Devanagari shirorekha-style horizontal bar on its Latin glyphs - seeing it
rendered, that claim was wrong, and it doesn't have the "fake Devanagari English
lettering" look (the Samarkan/DS Izmir style) that was actually wanted. That entire
font genre is dominated by unverified-license novelty fonts (Samarkan itself is 1993
shareware, personal-use-only; DS Izmir has the same unverified-EULA problem) - no
clean OFL equivalent exists. Decision as of 2026-07-20: hand-trace a custom
Tamil/Malayalam-glyph-inspired English look-alike font, fully owned, no license risk.
**Not started as a build task.** Until it exists, Yatra One stays wired into both
`app/src/index.css` (`.auth-logo`, `.wordmark .name`) and `site/style.css`
(`.wordmark`) - don't rip it out unprompted.

## Analytics: Cloudflare Web Analytics

Chosen over Google Analytics, Plausible, Umami, GoatCounter because: free (the domain
is already on Cloudflare), cookieless, no consent banner needed, zero extra
infrastructure. Live since 23 July 2026 via **automatic RUM injection** at the
Cloudflare edge (Analytics & Logs -> Web Analytics -> nithyakarma.org -> Manage site ->
"Enable") - no JS snippet in the HTML at all, since the domain is now proxied through
Cloudflare. Each HTML file has a comment noting this so nobody re-adds a manual snippet.
A short paragraph was added to the app's real Privacy Policy
(`app/src/components/LegalPages.jsx`, `PrivacyPage`, "Marketing site (nithyakarma.org)"
section) disclosing this.

**Rejected: Ghost.org / TryGhost.** A full CMS+newsletter platform needing either a
real server (2GB+ RAM, Node, MySQL, Nginx) or paid Ghost(Pro) hosting ($15+/mo) -
overkill for 3 fixed pages. Revisit only if a recurring blog/newsletter is genuinely
wanted later; not needed for the current site.

## AI crawler policy (`site/robots.txt`)

Blocks training-only bots (GPTBot, ClaudeBot, anthropic-ai, Google-Extended, CCBot),
allows answer/search bots (OAI-SearchBot, PerplexityBot, Claude-SearchBot). Lets the
site be cited in AI answers (ChatGPT, Perplexity, Google AI Overviews) without
contributing to model training datasets. Everyone else (Googlebot, Bingbot, etc.) is
allowed via the closing wildcard rule.

## Legal pages: linked, not duplicated

`site/*.html` footers link to the app's existing `/privacy` and `/terms` routes
(currently `https://nithykarma.netlify.app/privacy` etc.) rather than maintaining a
second copy. Single source of truth; update the app's `LegalPages.jsx` and both
surfaces stay correct.

## Platform badges - Play Store / App Store not live yet

`site/index.html` has a `.platform-badges` row: "Open the web app" (live), plus
"Android - coming soon" and "iOS - coming soon" badges. The real store-link markup is
written but HTML-commented out, ready to uncomment when each ships:

```html
<!-- <a class="btn btn-outline" href="https://play.google.com/store/apps/details?id=org.nithyakarma.app">Get it on Google Play</a> -->
<span class="badge">Android - coming soon</span>
<!-- <a class="btn btn-outline" href="https://apps.apple.com/app/idXXXXXXXXX">Download on the App Store</a> -->
<span class="badge">iOS - coming soon</span>
```

Reality as of 2026-07-20 (see `docs/ROADMAP.md`'s "Release status" callout): **nothing
is published anywhere.** No Play Store listing (screenshots still draft, per
`docs/store-screenshots/README.md`). No iOS platform exists in the Capacitor project
at all (`app/android` only, no `app/ios`) - adding it means `npx cap add ios` plus a
Mac, Xcode, and a paid Apple Developer account, not just a site change. Android
testing-track release is planned for the week of 2026-07-27; iOS is Phase 3.

## Deploy plan

- Second Netlify site created, `site/netlify.toml` sets `base = "site"` - live at
  `https://tranquil-jalebi-88d0eb.netlify.app/`. `nithyakarma.org` still needs pointing
  at it (Cloudflare DNS + Netlify custom domain add - not yet done)
- `app.nithyakarma.org` gets added as an *additional* custom domain on the **existing**
  Netlify site that already serves `nithykarma.netlify.app` - that origin must keep
  resolving, not get replaced (continuity for the developer's own test push
  subscriptions and workflow; see `docs/ROADMAP.md`)
- Remaining checklist items (Supabase Auth redirect allow-list, `push.ts`'s `APP_URL`,
  Android App Links) are tracked in `docs/ROADMAP.md`, not duplicated here

## Related

- [00-OVERVIEW.md](00-OVERVIEW.md) - where `/site` fits in the overall deploy topology
- [10-FOLDER-TREE.md](10-FOLDER-TREE.md) - the literal file listing
- `docs/ROADMAP.md` - the domain/DNS cutover checklist and release-status callout
