# Nithyakarma - Architecture Documentation

Authoritative reference for the Nithyakarma codebase, database and infrastructure.

**Purpose:** an AI (or a new contributor) reviewing this project should start here
instead of scanning the codebase cold. Every claim in these documents was verified
against the repo, the live Supabase project (`fkrifejzhnhknkuyhjhp`) or a running
build - not copied from older prose docs.

**Last verified:** 18 July 2026, against app version `0.15.4`.

## Index

| Doc | Covers |
|---|---|
| [00-OVERVIEW.md](00-OVERVIEW.md) | System map, stack, deploy topology, data flow |
| [01-DATABASE.md](01-DATABASE.md) | All 13 tables, columns, constraints, indexes, RLS, grants |
| [02-RPCS.md](02-RPCS.md) | All 13 Postgres functions and their behaviour |
| [03-EDGE-FUNCTIONS.md](03-EDGE-FUNCTIONS.md) | Edge functions, cron schedule, secrets |
| [04-MIGRATIONS.md](04-MIGRATIONS.md) | Migration ledger and the drift-check procedure |
| [05-FRONTEND.md](05-FRONTEND.md) | Routes, components, hooks, utils, state flow |
| [06-ANDROID.md](06-ANDROID.md) | Capacitor, manifest, plugins, build and release |
| [07-NOTIFICATIONS.md](07-NOTIFICATIONS.md) | Push architecture end to end |
| [08-PANCHANGAM.md](08-PANCHANGAM.md) | Panchangam data pipeline and annual maintenance |
| [09-STATUS-LEDGER.md](09-STATUS-LEDGER.md) | Verified status of every planned Intent |

## Relationship to the other docs

These files describe **what exists**. The planning documents describe **what is
intended**:

- `docs/UPGRADE-PLAN.md` - the Intent-by-Intent execution plan with testing gates
- `docs/ROADMAP.md` - product ideas beyond the current feature set
- `docs/TEST-PLAN.md` / `docs/TEST-RESULTS.md` - manual test matrix and results
- `docs/DATA-SAFETY.md` - Play Store Data Safety declarations
- `docs/DISSECTION.md` - the original pre-launch teardown

When these disagree with a planning document, **these win** - they are regenerated
from live state. See [09-STATUS-LEDGER.md](09-STATUS-LEDGER.md) for the reconciliation.

## Keeping this current

Regenerate after any schema change, new edge function, or new route. The cheapest
refresh path is the Supabase MCP:

- `mcp__supabase__list_tables` (verbose) for `01`
- `pg_proc` query for `02`
- `mcp__supabase__list_migrations` for `04`
- `cron.job` query for `03`
