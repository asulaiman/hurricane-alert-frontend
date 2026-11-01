# hurricane-alert

Web app that uses your device's geolocation (or a manually searched location)
to pull live forecast data from [Open-Meteo](https://open-meteo.com/) and
surface storm advisories based on forecast wind, gusts, rainfall, and pressure
trends — alongside real official alerts from the
[National Weather Service](https://www.weather.gov/documentation/services-web-api)
(US) and [GDACS](https://www.gdacs.org/) (global). Users can opt into browser
push notifications or email alerts for a saved location.

Our own advisory thresholds (tropical-storm / hurricane-force wind, flash
flood rainfall) are heuristics defined in this app, not official warnings —
Open-Meteo has no hurricane-specific feed to source those from. The Official
Alerts section is the real NWS/GDACS data.

SMS alerts are not implemented yet — Twilio has no workable free tier for
texting people who aren't pre-verified numbers on your own account, and real
volume requires a paid account plus A2P 10DLC registration. The schema
(`subscribers.phone`, `channels.sms`) is already in place for when that's set up.

## Run locally

```sh
npm install
cp .env.local.example .env.local   # fill in DATABASE_URL at minimum, see below
npm run migrate                     # applies scripts/schema.sql
npm run dev
```

`npm run dev` serves both the frontend and the `/api/*` routes (via a small
Vite middleware in `api/_lib/devServer.ts`) — no Vercel CLI or account needed
to develop locally. Open the printed local URL, click "Use My Location" or
search for a city, and both the heuristic advisory and the Official Alerts
section should populate.

## Environment variables

See `.env.local.example` for the full list with explanations. Everything
except `DATABASE_URL` can stay blank while developing — email sends and push
sends log to the console instead of actually sending when their keys are unset.

Accounts you'll need before alerting actually delivers to real people:

- **A Postgres database.** Anything works locally; in production use
  [Neon](https://neon.tech) (free tier). Run `npm run migrate` against it once.
- **[Resend](https://resend.com)** for email — free tier is 100/day, but you
  must verify a sending domain (SPF/DKIM) first, or `RESEND_FROM` won't deliver.
- **VAPID keys** for browser push — no account, just run:
  ```sh
  npx web-push generate-vapid-keys
  ```
  Put the public key in both `VAPID_PUBLIC_KEY` and `VITE_VAPID_PUBLIC_KEY`.
- **[Vercel](https://vercel.com)** (or any host that runs the `/api/*.ts`
  files as Node serverless functions) to deploy. Note: Vercel's Hobby plan
  terms are scoped to non-commercial personal use — fine for development,
  but budget for Pro if this gets real public traffic.

## Scheduled checks (cron)

Vercel's Hobby plan caps Cron Jobs at once per day, which is useless for
storm monitoring. Instead, `.github/workflows/check-subscriptions.yml` runs
every 20 minutes and calls the deployed `/api/cron/check-subscriptions`
endpoint. Once deployed, set these two repo secrets
(Settings → Secrets and variables → Actions):

- `APP_BASE_URL` — your deployed URL
- `CRON_SECRET` — must match the `CRON_SECRET` env var on the deployment

GitHub disables scheduled workflows on repos with no activity for a while —
worth an occasional check that it's still running.

## Compliance notes (read before public launch)

This implements the mechanical basics — explicit consent capture with a
timestamp, one-click unsubscribe with no login, a mailing-address footer on
emails, rate-limited verification sends — but none of this has been reviewed
by a lawyer. If this goes out to real strangers, get a real CAN-SPAM/TCPA
review before relying on it, especially once SMS is added.
