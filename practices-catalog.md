# Nithyakarma Tracker - Practice Catalog v1

Master list for the general category dropdown. Sandhyavandhanam is the constant,
pre-associated practice (3 sandhyas + Gaayatri 108) and is not part of this list.
This list seeds the `practices` table in Supabase; admin can extend it without app updates.

## Tier ladder (punya-point based)

Jijnasu -> Sadhaka -> Tapasvi -> Rishi -> Brahmarishi

- Jijnasu: the seeker (Gita 7.16)
- Sadhaka: committed practitioner
- Tapasvi: steady tapas / discipline
- Rishi: sage
- Brahmarishi: highest earned title (Vishwamitra's ladder - instantly recognizable)

## General category practices (14)

No seasonal practices - keeping it simple with daily, weekly, count, and sequence types only.

| # | Practice | Default cadence | Notes for our audience |
|---|----------|-----------------|------------------------|
| 1 | Vishnu Sahasranamam | Daily | The flagship; carried over from existing tracker |
| 2 | Lalitha Sahasranamam | Daily | Second most-common household parayanam |
| 3 | Hanuman Chalisa | Daily | Universal across households |
| 4 | Narayaneeyam | 1 dasakam / day | Guruvayur devotion - core Kerala practice |
| 5 | Bhagavad Gita Parayanam | 1 chapter / day | 18-chapter cycles map naturally to progress UI |
| 6 | Aditya Hrudayam | Sundays | Weekly cadence |
| 7 | Sri Rudram (Namakam-Chamakam) | Mondays | Weekly cadence, Shiva |
| 8 | Shiva Panchakshari Japam | Daily (108) | Count-based like Gaayatri |
| 9 | Devi Mahatmyam (Saptashati) | Fridays | Weekly cadence, Devi |
| 10 | Soundarya Lahari | Daily | Adi Shankara - Kerala pride, verse-based |
| 11 | Mukundamala | Daily | Kulasekhara Alwar - Kerala-rooted Vishnu stotram |
| 12 | Subrahmanya Bhujangam | Tuesdays | Subrahmanya devotion runs deep in Kerala |
| 13 | Dakshinamurthy Stotram | Thursdays | Guru-vara cadence |
| 14 | Bhagavatam Parayanam | Daily reading | Open-ended reading practice |

## Cadence types the schema must support

- `daily` (most)
- `daily_count` (e.g. 108 japam counts)
- `weekly` (fixed weekday: Sun/Mon/Tue/Thu/Fri)
- `sequence` (dasakam / chapter progress with cycle completion)

## Sandhyavandhanam rules (the constant practice)

- Shown only for **male** profiles (post-upanayanam); always daily, 3 sandhya slots.
- Interstitial ad after **every** submit - sandhya (up to 3/day) and general practices
  (1 per submit). The ad fires only after the submit API call succeeds and the log is
  verified as saved, never before - a failed save must never show an ad.
  No pricing tiers - app is fully free.
- Ads are **Android app only**: AdMob interstitials are a native SDK, they do not run
  on the web app. Web (iPhone users) keeps the celebration + WhatsApp share modal
  without the ad - the share/referral loop matters more than web ad revenue.

## Kids (family member profiles)

- Each family member profile has its own streaks and punya points, marked by the parent.
- **Bala Sabha**: a separate kids leaderboard tab - family member profiles never appear
  on the adult leaderboard. First name only, parent opts each child in, own weekly
  Hall of the Week and simpler badges.
- Everything is managed from the parent's account; children have no logins.
- Children under 15 have no phones: parent adds them as **family member profiles**
  (same `family_members` model + profile switcher as the existing Sandhyavandhanam app)
  and marks their anushtanams on their behalf.

## Product notes

- Sequence practices (4, 5, 14) show "Dasakam 34/100" style progress instead of a plain checkmark.
- Weekly practices must not break the daily streak on off-days - the streak counts
  only the practices scheduled for that day. Example: Aditya Hrudayam is Sundays-only,
  so on Monday it does not appear in the Today list and cannot break the streak.
