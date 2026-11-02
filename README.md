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

The extraction and ownership cleanup are integrated into frontend `main`.
The default branch contains only the frontend; backend routes, migrations,
and scheduled checks live in the backend repository.

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

## Automatic fix proposals

The proposed `propose-test-fix.yml` workflow uses the Copilot cloud agent
[agent tasks API](https://docs.github.com/en/rest/agent-tasks/agent-tasks).
It is **not enabled until published on the default branch and configured**.
The API is a public preview; starting tasks currently requires Copilot
Business or Enterprise eligibility for the token's user.

An administrator should create an expiring **fine-grained personal access
token**, resource owner `asulaiman`, limited to these two selected repositories:
`hurricane-alert-frontend` and `hurricane-alert-backend`. Grant only repository
**Agent tasks: read and write** (metadata read is implicit). Store the token
directly as the Actions secret `COPILOT_AGENT_TOKEN` in both repositories.
Never paste its value into chat, source, logs, or an issue. Do not reuse the
desktop session token. GitHub App installation tokens and Actions'
`GITHUB_TOKEN` cannot start these tasks. The workflow's separate ephemeral
`GITHUB_TOKEN` has contents/actions/PR read and issues write solely for
inspection and durable attempt records. Keep `SLACK_WEBHOOK_URL` configured.
Enable Copilot cloud agent for both repos and ensure the token owner has
write access and an eligible subscription. Rotate the token before expiry.

Only a failed **test step** from a trusted user's default-branch push is
eligible. Fork/PR, bot, simulation, fix-branch, stale-commit, successful, and
cancelled runs are excluded. The handler checks out only the default branch,
never failed-run code/artifacts, and sends a fixed investigation prompt with
the failed-run URL rather than interpolating logs as instructions.

One tracking issue reserves each failed commit before one paid agent task is
started. This issue is bookkeeping, not a substitute for a code fix PR.
Concurrent runs and retries do not create another attempt for that commit.
Copilot must reproduce the failure, propose a minimal fix on another branch,
retain test coverage, link the run, and explain validation. No auto-merge is
performed. After task completion, the workflow verifies an open, non-empty
Copilot PR with the correct repo/base and exact task artifact ID before sending one
additional Slack message with its PR URL. Existing immediate failure alerts
are retained separately.

The verifier checks GitHub's Copilot bot identity, not a guessed agent login.
If the agent omits the failed-run URL from its PR body, the workflow adds a
provenance comment containing that URL and the tracking issue/task IDs.
Completed tasks may expose their PR artifact or changes with a delay; these
are polled within the same bounded attempt, never by starting another task.

Observation is bounded to 45 minutes with no automatic task or Slack POST
retry. Timeout, missing/empty PR, permission errors, or uncertain delivery
fail explicitly and leave the tracking issue for human investigation; the
agent may continue after observation times out. Inspect the task/issue/channel
before any manual retry. This bounds attempts, not the provider's AI billing;
manage plan budgets separately. PR correctness still requires human review.
`npm run test:notifications` exercises this orchestration with mocked APIs,
including fork/loop/deduplication guards and no-real-message failure paths.
Live agent execution is not validated without the configured token/eligibility.

## Compliance notes (read before public launch)

This implements the mechanical basics — explicit consent capture with a
timestamp, one-click unsubscribe with no login, a mailing-address footer on
emails, rate-limited verification sends — but none of this has been reviewed
by a lawyer. If this goes out to real strangers, get a real CAN-SPAM/TCPA
review before relying on it, especially once SMS is added.
