# Production and password recovery

The production server serves the compiled React app and `/api` from one origin.
Vite's development server and a temporary tunnel are not needed in production.
The source changes do not replace an already running public tunnel or publish a host automatically.

## Build and run

Use Node 22 and a MongoDB replica set (including Atlas). From the repository root:

```sh
npm --prefix client ci
npm --prefix server ci
npm run build
npm start
```

`npm start` sets `NODE_ENV=production` and loads `server/.env` if present. A deployment
host may instead inject environment variables. The server listens on `PORT`, default 5000.
It serves deep links such as `/dashboard?tab=receiving`, static assets and the API.
Unknown `/api` routes remain JSON 404 responses.

For the same-origin build, leave `VITE_API_URL` unset or set it to `/api` before building.
Set `MONGODB_URI`, `JWT_SECRET` (at least 32 random characters), `CLIENT_ORIGIN` and
`PUBLIC_APP_URL` for the permanent HTTPS domain. Do not retain localhost origins on the
production host. If the host has a reverse proxy, configure `TRUST_PROXY_HOPS` to its
actual trusted hop count; do not set it without checking the host's proxy arrangement.

A Dockerfile is included as an alternative:

```sh
docker build -t foodrescue .
docker run --env-file server/.env -e NODE_ENV=production -p 5000:5000 foodrescue
```

The image builds the frontend, installs only server runtime dependencies in its final
stage, excludes local environment files, and runs as the unprivileged `node` user.
The Docker image itself has not been built or deployed in this workspace.

Connect a permanent domain and HTTPS through your chosen hosting service, set its
health-check path to `/api/health`, and use the production start command or Dockerfile.
Hosting/account/domain settings are still required to replace the temporary public URL.

## Password reset email

The adapter uses the [Resend email API](https://resend.com/docs/api-reference/emails/send-email).
Configure these server variables:

```dotenv
PUBLIC_APP_URL=https://your-permanent-domain.example
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=FoodRescue <accounts@your-verified-domain.example>
```

Use a verified sender/domain in your email service. The UI links `/login` to
`/forgot-password`. Reset links expire after 30 minutes, can be used only once, and
store only a token hash in the database. The token is in a URL fragment so it is not
sent in access logs or referrers. A successful reset invalidates existing login tokens.
Unknown emails receive the same success response as known emails. Missing configuration
and provider failures show an actionable error. No real reset email was sent during testing.

Browser sessions now survive tab closure through local storage, with the existing
12-hour token lifetime and logout synchronization between tabs. This retains bearer-token
authentication; migrating to an HTTP-only cookie session remains a separate hardening task.

## Regression checks

```powershell
$env:RUN_DB_TESTS='1'
npm --prefix server test
npm run build
node scripts/browser-regressions.mjs
```

Database checks create and remove only their unique `foodrescue_test_*` database.
Browser checks use synthetic API responses and the production bundle; they do not mutate
real accounts or send email. Set `BROWSER_PATH` if Chrome/Edge is not in a standard Windows
location. In a restricted runner that cannot start Chromium's renderer sandbox, the test
harness supports `BROWSER_NO_SANDBOX=1` for its isolated synthetic test browser only.
External fonts/images are blocked in the browser harness so those services cannot stall tests.
