# FoodRescue — Heritage MERN application

FoodRescue is a React + Vite / Express + Node.js / MongoDB + Mongoose food donation coordination MVP. It connects food donors, verified NGOs, volunteers and administrators. The current feature set includes JWT authentication, account verification, food listings and requests, quantity reservation during approval, volunteer pickup workflows, receipt confirmation, in-app notifications, audit history, admin metrics and optional Razorpay sponsorship checkout.

The refactor reorganizes the existing application into feature-oriented modules and shared providers/components. Existing API paths, payloads, role checks, database fields, status values and user-facing workflows are retained.

> **Operational note:** This is still an MVP, not a fully audited production service or food-safety certification system. Real distribution requires qualified local partners and compliance with applicable food handling, storage, transport and charitable-distribution requirements.

## Technology

- **Frontend:** React 18, Vite, React Router, Lucide icons
- **Backend:** Node.js, Express, JWT, bcrypt, Zod
- **Database:** MongoDB and Mongoose
- **Payments:** Optional Razorpay checkout and webhook verification

## Project structure

```text
foodrescue-heritage/
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   └── razorpay.js
│   │   ├── modules/
│   │   │   ├── auth/           # Registration, login, current user
│   │   │   ├── users/          # User model and dashboard summary
│   │   │   ├── donations/      # Donation model and listing APIs
│   │   │   ├── requests/       # NGO requests and donor decisions
│   │   │   ├── assignments/    # Volunteer assignment and delivery workflow
│   │   │   ├── payments/       # Payment model, API and gateway routes
│   │   │   ├── notifications/  # Notifications, audit model and API
│   │   │   └── admin/          # Account verification, metrics and audit APIs
│   │   ├── middleware/
│   │   │   ├── authenticate.js
│   │   │   ├── authorize.js
│   │   │   └── errorHandler.js
│   │   ├── models/             # Compatibility model export barrel
│   │   ├── utils/
│   │   ├── app.js
│   │   └── index.js
│   ├── scripts/
│   ├── tests/
│   └── .env.example
└── client/
    ├── src/
    │   ├── app/                # App composition, providers and routes
    │   ├── components/
    │   │   ├── layout/         # Navbar, footer and dashboard shell
    │   │   ├── ui/             # Shared Button, Field, Modal, Notice, EmptyState
    │   │   └── auth/           # Protected route
    │   ├── features/
    │   │   ├── auth/
    │   │   ├── donor/
    │   │   ├── ngo/
    │   │   ├── volunteer/
    │   │   ├── admin/
    │   │   ├── payments/
    │   │   └── dashboard/
    │   ├── pages/
    │   ├── providers/          # ThemeProvider
    │   ├── hooks/              # useTheme
    │   ├── services/           # Shared API client
    │   ├── styles/             # Theme tokens, components and global layout styles
    │   └── main.jsx
    ├── index.html
    └── package.json
```

The shared UI primitives follow a small copy-and-compose pattern similar to shadcn/ui: components live in the repository and are styled using the application's semantic CSS tokens. No runtime dependency on shadcn/ui was added, and the existing heritage visual system remains in place.

## Run locally

Requirements: Node.js 20.19+ or recent Node 22, npm, and MongoDB. Approval uses MongoDB transactions, so configure MongoDB Atlas or a local replica set rather than a standalone MongoDB server.

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
```

Set `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters, and `CLIENT_ORIGIN=http://localhost:5173`. Add Razorpay **test** credentials only when testing sponsorship checkout. Keep `.env` out of source control.

```bash
npm run dev
```

### 2. Frontend

In a second terminal:

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. `VITE_API_URL` defaults to `/api`. Vite forwards it to `http://127.0.0.1:5000`, so local development no longer depends on a tunnel. Restart Vite after changing environment variables. For mobile testing, open the Network URL printed by Vite on a device on the same network. Production hosting must route `/api` to the backend, or set `VITE_API_URL` to the backend HTTPS URL and allow the frontend origin in `CLIENT_ORIGIN` (comma-separated origins are supported).

### 3. Create the first administrator

In the `server` directory, with `.env` configured:

```bash
node scripts/create-admin.js admin@example.com 'Use-A-Long-Random-Password-123' "Platform Admin"
```

Use a unique password. Then register donor and NGO accounts, verify them through the admin workspace, and run the donation-to-delivery flow.

## Feature and API map

| Feature | Endpoints |
|---|---|
| Authentication | `POST /api/auth/register`, `POST /api/auth/login`, `GET/PATCH /api/auth/me` |
| Donations | `GET/POST /api/donations`, `GET/PATCH /api/donations/:id`, `GET /api/donations/nearby`, `POST/GET /api/donations/:id/requests` |
| Requests | `GET /api/requests/mine`, `PATCH /api/requests/:id/decision` |
| Assignments | `POST /api/requests/:id/assignments`, `GET /api/assignments/mine`, `GET /api/assignments/receiving`, `PATCH /api/assignments/:id/status`, `POST /api/assignments/:id/confirmation`, `GET /api/volunteers` |
| Users and notifications | `GET /api/dashboard/summary`, `GET /api/notifications`, `PATCH /api/notifications/:id/read` |
| Administration | `GET /api/admin/users`, `PATCH /api/admin/users/:id/status`, `GET /api/admin/summary`, `GET /api/admin/payments`, `GET /api/admin/audit` |
| Payments | `GET /api/payments/config`, `POST /api/payments/create-order`, `POST /api/payments/verify`, `GET /api/payments/mine`, `POST /api/payments/webhook` |

Protected endpoints continue to use `Authorization: Bearer <jwt>`. Role and verification checks remain server-side; the frontend route guard is only a navigation convenience.

## Validation

From `server/`:

```bash
npm test
```

From `client/`:

```bash
npm run build
```

Authentication and workflow regression tests are in `server/tests/workflow.test.js`. The database tests require explicit opt-in: in PowerShell, run `$env:RUN_DB_TESTS='1'; npm.cmd test` from `server/`. They use `MONGODB_URI` to create a uniquely named `foodrescue_test_*` database, run all four login roles and the donation-to-receipt workflow, and drop only that test database. The database user needs permission to create/drop a test database. Without opt-in, database tests are skipped.

If PowerShell blocks npm.ps1, use `npm.cmd`. If Vite configuration bundling is blocked by filesystem permissions in a restricted workspace, build with `node --input-type=module -e "import {build} from 'vite';import config from './vite.config.js';await build({...config,configFile:false});"` from `client/`.

## Production hardening still required

Before public deployment, complete a security and operations review. In particular: move browser authentication to secure `httpOnly` cookies or another reviewed session strategy; add email verification and MFA for administrators; add distributed rate limiting and request logging; test transaction and webhook idempotency under concurrency; review payment reconciliation/refunds and fundraising eligibility; configure HTTPS and secret rotation; add integration/end-to-end tests; and validate accessibility, privacy retention, backup and monitoring procedures.

Maps, live GPS, images/file storage, general email/SMS/push notifications, Socket.IO events, automated expiry jobs and advanced analytics are not implemented in this MVP. The donation workflow is a coordination record only and does not certify food safety.

## Reliability and UI fixes (November 2026)

- Authentication schemas and account services live in the auth module. Registration creates the user and organization atomically; a replica set is required.
- Every assignment endpoint authenticates before checking roles. Temporary database/network failures return service errors instead of invalidating sessions.
- Session restoration waits for account validation and offers retry on service outages. Login email normalization, validation details, request timeouts and expired-session handling are shared.
- Responsive layout rules live in `client/src/styles/responsive.css`; theme tokens and reusable form/modal components remain shared. Dialogs support keyboard focus containment, Escape and focus restoration.
- Database-backed tests passed for all four login roles, verification restrictions, partial approval, assignment, collection and receipt. Payment gateway behavior was not tested.

Vite scripts use the native JavaScript config loader to avoid unnecessary configuration bundling in restricted Windows workspaces. The later workflow repair adds browser automation against the production bundle; visual review on real mobile devices remains outstanding.

## Workflow repairs and production setup

- Receipt confirmation clears stale errors and shows a success message. Collection uses a validated in-page dialog with dismissal feedback.
- Donors can edit descriptions/handling instructions and cancel eligible listings. NGOs can cancel uncollected requests; cancellations release reservations atomically. Volunteers can record failed pickups.
- Request/assignment messages are visible and name the listing/volunteer. NGOs receive decision, assignment and collection notifications.
- Future preparation times are rejected by the server. Volunteer selection exposes names and IDs only.
- Admin verification/suspension require confirmation. Audit entries resolve participant names and listing titles.
- Dashboard tabs have shareable query URLs, sessions persist across tabs for the existing 12-hour lifetime, and dark primary buttons have improved contrast.
- Forgot/reset password screens and expiring single-use reset endpoints are implemented. Email delivery requires configuration.
- Production static hosting and a Dockerfile are included. See [DEPLOYMENT.md](DEPLOYMENT.md) for commands, email settings and remaining live-host requirements.

Additional API routes: `PATCH /api/requests/:id/cancel`, `POST /api/auth/forgot-password`, and `POST /api/auth/reset-password`.
The donor edit/cancel action continues to use `PATCH /api/donations/:id`.

Validation covers the real database workflow and synthetic browser interactions against the compiled production app. Payment checkout, actual email delivery and public hosting were not exercised.
