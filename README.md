# ozbargain-watcher

Monitor [OzBargain](https://www.ozbargain.com.au/deals) and alert when deals are upvoted quickly.

Default trigger: **more than 15 upvotes in 45 minutes** (configurable). Alerts go to **console / Vercel logs** via a pluggable notifier.

## Stack

- Next.js (App Router) on Vercel
- OzBargain RSS: `https://www.ozbargain.com.au/deals/feed`
- Upstash Redis for vote history, cooldowns, and config overrides
- Vercel Cron every 2 minutes (`vercel.json`)

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Required in production:

| Env | Purpose |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Vote history + config |
| `CRON_SECRET` | Protects `/api/watch` and config writes |

Optional:

| Env | Default | Purpose |
| --- | --- | --- |
| `ALERT_VOTE_DELTA` | `15` | Alert when vote gain **>** this in the window |
| `ALERT_WINDOW_MINUTES` | `45` | Rolling window |
| `ALERT_COOLDOWN_HOURS` | `6` | Per-deal alert cooldown |
| `CATEGORY_ALLOWLIST` | empty (all) | Comma-separated `/cat/` slugs |
| `ADMIN_SECRET` | — | Alternate secret for config UI |
| `NOTIFIER` | `console` | Notifier backend |

Without Redis credentials, the app uses an **in-memory** store (fine for local single-process runs; not for multi-instance production).

## Deploy on Vercel

1. Create an Upstash Redis database and connect it to the Vercel project (Marketplace).
2. Set `CRON_SECRET` in project env vars (Vercel Cron sends it as `Authorization: Bearer …`).
3. Deploy. Cron hits `GET /api/watch` every 2 minutes.

**Hobby plan note:** Vercel Cron on Hobby is limited to once per day. For 2-minute polling on Hobby, point an external cron (e.g. cron-job.org) at:

`https://YOUR_APP.vercel.app/api/watch` with header `Authorization: Bearer CRON_SECRET`.

## Local watch loop

With `npm run dev` running in another terminal:

```bash
CRON_SECRET=change-me npm run watch
# or a single run:
WATCH_ONCE=1 CRON_SECRET=change-me npm run watch
```

## API

| Route | Auth | Role |
| --- | --- | --- |
| `GET /api/watch` | Bearer / `?secret=` | Fetch → detect → notify |
| `GET /api/config` | no | Current config + known categories |
| `PUT /api/config` | yes | Update Redis overrides |
| `DELETE /api/config` | yes | Clear Redis overrides |
| `GET /api/health` | no | Liveness + store ping |
| `GET /` | no (writes need secret) | Status + settings UI |

## Category allowlist

Parsed from each deal’s `/cat/{slug}` RSS category. Empty allowlist = all categories. Configure via env, Redis overrides, or the status page checkboxes.

## Multi-user later

v1 is single-operator. Code keeps shared vote history, pure helpers that take `WatcherConfig`, a notifier interface, and separate `alerted:{dealId}` keys so a future per-user fan-out does not require a rewrite.
