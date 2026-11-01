# hurricane-alert-frontend

Web app that uses your device's geolocation (or a manually searched location)
to pull live forecast data from [Open-Meteo](https://open-meteo.com/) and
surface storm advisories based on forecast wind, gusts, rainfall, and pressure
trends — alongside real official alerts from the
[National Weather Service](https://www.weather.gov/documentation/services-web-api)
(US) and [GDACS](https://www.gdacs.org/) (global). Users can opt into browser
push notifications or email alerts for a saved location.

The API source and deployment configuration live in the separate
[hurricane-alert-backend](https://github.com/asulaiman/hurricane-alert-backend) repository.

Our own advisory thresholds (tropical-storm / hurricane-force wind, flash
flood rainfall) are heuristics defined in the backend, not official warnings —
Open-Meteo has no hurricane-specific feed to source those from. The Official
Alerts section is the real NWS/GDACS data.

SMS alerts are not implemented yet — Twilio has no workable free tier for
texting people who aren't pre-verified numbers on your own account, and real
volume requires a paid account plus A2P 10DLC registration. The schema
(`subscribers.phone`, `channels.sms`) is in the backend for when that's set up.

## Ownership and branch state

The backend owns forecast fetching, advisory calculations, official alerts,
subscriptions, database migrations, delivery, and scheduled checks. This repo
owns location search, browser permissions/push registration, and presentation.
`GET /api/forecast` returns `{ current, timezone, advisory }`; the frontend
renders that result rather than keeping its own thresholds or weather parser.
Local TypeScript response interfaces describe the HTTP boundary, not a shared
source package or a dependency on the backend checkout.

The original extraction is on `asulaiman-extract-hurricane-api`, not merged into
frontend `main`. That default branch still contains the old combined app.
This cleanup does not merge or rewrite it; the split branch must be reviewed
and integrated separately to remove those old copies from the default branch.

## Run locally

```sh
npm install
cp .env.local.example .env.local
npm run dev
```

Run the API from its own repository in a second terminal. Its README covers
database setup, migrations, and API environment variables. The frontend uses
`VITE_API_BASE_URL` to call it; locally this should be `http://localhost:3001`.

## Environment variables

See `.env.local.example` for frontend settings. Set `VITE_API_BASE_URL` to the
public API origin when deploying the frontend. The API repository documents
database, email, push, deployment, and scheduled-check configuration.

## UI tests

```sh
npm ci
npm run test:e2e       # starts an isolated frontend and runs Cypress headlessly
npm run test:e2e:open  # starts the same frontend and opens the Cypress runner
```

The test server uses port 5174, leaving the normal local preview on 5173 alone.
`.env.test` contains public synthetic settings only. Cypress stubs weather,
geocoding, and the separate API origin; no backend, database, email provider,
or real push credentials are needed. Browser geolocation and push registration
are also controlled by the tests.

Coverage includes search/selection and retry, geolocation success/denial,
forecast loading and refresh after failure, backend-provided advisory rendering,
official warnings and supplementary empty/error states, consent/email
validation, subscription success/server errors, and push registration/save
success/failure. These tests validate UI behavior and request contracts, not
real provider delivery or backend persistence.

## GitHub Actions failure alerts

`.github/workflows/ui-tests.yml` runs the build and UI/notification tests for
pushes and pull requests. Failed tests—not successful or cancelled runs—invoke
the Slack notifier with the service, repository, branch/ref, and failed-run
link. Original test failures still fail the job; notification failures are
reported explicitly.

To enable delivery, an authorized Slack administrator must create an incoming
webhook for **#hurricane-app-alerting** (channel `C0CDX2E5546`). Store its URL
directly in this repository's **Settings > Secrets and variables > Actions**
as `SLACK_WEBHOOK_URL`. Repeat secret setup in `asulaiman/hurricane-alert-backend`.
Do not paste webhook URLs into chat, commit them, or print them in logs.
The webhook's channel is configured in Slack, not overridden by the workflow.
Until the webhook and secrets exist, live delivery is unavailable; a failed
trusted test run reports the missing configuration.

Fork pull requests run tests without secrets and skip Slack notification;
the workflow uses no `pull_request_target` or elevated permissions.
`npm run test:notifications` validates failure, success, cancellation, safe
metadata encoding, and notification errors without sending Slack messages.

## Compliance notes (read before public launch)

This implements the mechanical basics — explicit consent capture with a
timestamp, one-click unsubscribe with no login, a mailing-address footer on
emails, rate-limited verification sends — but none of this has been reviewed
by a lawyer. If this goes out to real strangers, get a real CAN-SPAM/TCPA
review before relying on it, especially once SMS is added.
