# ozbargain-watcher

Monitor [OzBargain](https://www.ozbargain.com.au/deals) and alert when deals are upvoted quickly.

Default trigger: **more than 15 upvotes in 45 minutes** (configurable). Alerts go to **ntfy subscriptions** (per-user push topics) or, when no subscriptions exist, to a **console / env notifier** fallback (Vercel logs or a single operator ntfy topic).

## Stack

- Next.js (App Router) on Vercel
- OzBargain RSS: `https://www.ozbargain.com.au/deals/feed`
- Upstash Redis for vote history, cooldowns, subscriptions, and config overrides
- Scheduled watch via **external cron** every 2 minutes (Hobby-friendly) + optional daily Vercel Cron backup
- [ntfy](https://ntfy.sh) for push notifications to subscribers

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Required in production:

| Env | Purpose |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Vote history, subscriptions, config |
| `CRON_SECRET` | Protects `/api/watch` and config writes |

Optional:

| Env | Default | Purpose |
| --- | --- | --- |
| `ALERT_VOTE_DELTA` | `15` | Alert when vote gain **>** this in the window |
| `ALERT_WINDOW_MINUTES` | `45` | Rolling window |
| `ALERT_COOLDOWN_HOURS` | `6` | Per-deal alert cooldown |
| `CATEGORY_ALLOWLIST` | empty (all) | Comma-separated `/cat/` slugs (admin UI / legacy path only when subscriptions exist) |
| `ADMIN_SECRET` | — | Alternate secret for config UI |
| `NOTIFIER` | `console` | Operator fallback notifier when no subscriptions: `console` or `ntfy` |
| `NTFY_SERVER` | `https://ntfy.sh` | ntfy server for subscriber fan-out and operator fallback |
| `NTFY_TOPIC` | — | Operator fallback topic when `NOTIFIER=ntfy` and no subscriptions |
| `NTFY_TOKEN` | — | Optional ntfy access token for protected topics |

Without Redis credentials, the app uses an **in-memory** store (fine for local single-process runs; not for multi-instance production).

## Subscriptions (ntfy)

Users subscribe at **`/subscribe`**: pick categories, the app generates a unique ntfy topic, and returns a bookmarkable manage link.

Manage an existing subscription at **`/subscribe/[id]?token=...`** — update categories, pause/resume, send a test notification, or rotate the topic.

### How alerting works

1. **Shared detection** — every watch cycle fetches the feed once and detects hot deals using global thresholds (`ALERT_VOTE_DELTA`, `ALERT_WINDOW_MINUTES`).
2. **Per-subscriber fan-out** — for each enabled subscription, matching deals are sent via ntfy to that subscription's topic (always uses `NtfyNotifier`, independent of `NOTIFIER`).
3. **Per-subscriber cooldown** — Redis key `alerted:{subId}:{dealId}` prevents repeat notifications to the same subscriber for the same deal within `ALERT_COOLDOWN_HOURS`.

When **any enabled subscription exists**, the global `CATEGORY_ALLOWLIST` (env / Redis / admin UI) only affects the status page display — it is **not** used for alerting. Category filtering is per subscription instead.

When **no subscriptions exist**, the legacy path applies: global `CATEGORY_ALLOWLIST` + global `alerted:{dealId}` cooldown + the `NOTIFIER` env fallback (`console` logs or operator `ntfy` topic).

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

This is a safety net only — use the external cron for real "hot deal" latency.

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
| `POST /api/subscriptions` | no (rate-limited) | Create subscription; returns manage token + URL |
| `GET /api/subscriptions/[id]` | manage token | Get subscription |
| `PATCH /api/subscriptions/[id]` | manage token | Update categories, enabled, display name |
| `DELETE /api/subscriptions/[id]` | manage token | Delete subscription |
| `POST /api/subscriptions/[id]/test` | manage token | Send test ntfy notification |
| `POST /api/subscriptions/[id]/rotate-topic` | manage token | Rotate ntfy topic |
| `GET /` | no (writes need secret) | Status + settings UI |
| `GET /subscribe` | no | Create subscription UI |
| `GET /subscribe/[id]` | `?token=` | Manage subscription UI |

Subscription manage token: `Authorization: Bearer <token>`, `x-manage-token` header, or `?token=` query param.

`GET /api/watch` response includes `subscriptionsNotified` (count of per-subscriber ntfy sends in the cycle).

## Category allowlist

Parsed from each deal's `/cat/{slug}` RSS category. Empty allowlist = all categories.

- **With subscriptions:** each subscription has its own category allowlist; the global allowlist only affects the admin status UI.
- **Without subscriptions:** global allowlist (env, Redis overrides, or status page checkboxes) filters which hot deals trigger the operator fallback notifier.
