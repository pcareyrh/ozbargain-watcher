# ozbargain-watcher

Monitor [OzBargain](https://www.ozbargain.com.au/deals) and alert when deals are upvoted quickly.

Default trigger: **more than 15 upvotes in 45 minutes** (configurable). Alerts go to **console / Vercel logs** via a pluggable notifier.

## Stack

- Next.js (App Router) on Vercel
- OzBargain RSS: `https://www.ozbargain.com.au/deals/feed`
- Upstash Redis for vote history, cooldowns, and config overrides
- Scheduled watch via **external cron** every 2 minutes (Hobby-friendly) + optional daily Vercel Cron backup

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

## Deploy on Vercel (Hobby + external cron)

Vercel **Hobby** only allows Cron Jobs **once per day**, so frequent polling must come from an external scheduler. The app still exposes `GET /api/watch`; anything that can HTTP GET it on an interval works.

1. Create an Upstash Redis database and connect it to the Vercel project (Marketplace).
2. Set `CRON_SECRET` in project env vars.
3. Deploy and confirm the **Production** domain (not a protected preview URL).
4. Disable Deployment Protection for Production, **or** create a Protection Bypass token for cron.
5. Create an external cron job every **2 minutes** (e.g. [cron-job.org](https://cron-job.org), EasyCron, or GitHub Actions) that calls:

```bash
curl -sS \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://YOUR_PRODUCTION_DOMAIN/api/watch"
```

If Deployment Protection stays on, also send:

```bash
-H "x-vercel-protection-bypass: YOUR_BYPASS_TOKEN"
```

### Optional daily Vercel Cron

[`vercel.json`](vercel.json) schedules one Hobby-legal backup run at **09:00 UTC**:

```json
{ "crons": [{ "path": "/api/watch", "schedule": "0 9 * * *" }] }
```

This is a safety net only — use the external cron for real “hot deal” latency.

### Pro plan

On Vercel Pro you can switch the cron expression back to `*/2 * * * *` and drop the external scheduler if you prefer native Vercel Cron.

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
