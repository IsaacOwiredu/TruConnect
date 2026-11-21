# TruConnect

TruConnect is a Ghana-focused directory that will help customers find skilled local service providers. **Phases 1–5 are complete.** Discovery data, account profile editing, and dashboard features remain planned for later phases.

## Architecture

- `public/` holds the framework-free HTML, CSS, and browser JavaScript served to users. Pages currently include the landing page, professional discovery and profile, login, registration, and customer, worker, and admin dashboard previews.
- `server.js` starts the Express application and mounts the API routes.
- `src/app.js` creates and configures the Express app; `src/config/env.js` loads and validates the port setting.
- `src/config/` contains shared configuration such as the database connection.
- `src/models/` contains Mongoose models and database relationships for users, workers, categories, verification requests, reviews, and reports.
- `src/services/` contains database operations used by controllers.
- `src/services/auth.service.js` manages session rotation and the safe public user shape.
- `src/routes/` defines REST API endpoints; `src/controllers/` handles their request logic.
- `src/middleware/` holds reusable authentication, authorization, validation, and error handling.
- `src/config/session.js` configures HTTP-only sessions stored in MongoDB; `scripts/promote-admin.js` provisions administrator access for an existing account.
- `src/utils/` contains shared server-side helpers.
- `uploads/private/` is reserved for sensitive verification files and must never be served as static content. Production storage and access controls will be addressed with the verification feature.

The browser communicates with the Express REST API. Express uses Mongoose to access MongoDB. Uploaded identity and verification documents are kept outside `public/` and will require authenticated, authorized access.

## Initial setup

Requirements: Node.js 20 or newer. A MongoDB connection string is required for database and account features; the frontend preview can start without one. No database credentials are included in this repository.

```sh
npm install
```

Copy `.env.example` to `.env` when configuring a local environment, then set `MONGODB_URI` to your own MongoDB Atlas connection string. Add the development machine's IP address to the Atlas project's network access list and use a database user with only the permissions this application needs. Set `SESSION_SECRET` to at least 32 bytes of random secret text in production. If HTTPS is terminated at a reverse proxy, set `TRUST_PROXY_HOPS` to the number of trusted proxy hops; leave it at `0` when Node handles HTTPS directly. Do not commit `.env` or share its secrets.

```sh
npm run dev
```

With no `MONGODB_URI`, the site starts in frontend-preview mode and database-backed API routes return `503`. With a URI configured, startup waits for MongoDB before listening. `GET /api/health` and `GET /api/v1/health` report liveness and database state; `GET /api/health/ready` and `GET /api/v1/health/ready` report readiness. `GET /api/v1/categories` returns active categories from MongoDB. Schemas use timestamps, references, validation, and query indexes. Development automatically builds indexes; production disables automatic index creation so indexes can be managed during deployment. The frontend is available at the server root; its search cards are sample interface data until live listing APIs are connected.

Authentication endpoints: `GET /api/v1/auth/csrf`, `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, and `POST /api/v1/auth/logout`. Sessions use HTTP-only, SameSite cookies stored in MongoDB and encrypted in the session collection. Account changes require a CSRF token; login and registration have a stricter IP rate limit. Public registration accepts customer and worker roles only; workers start unverified. To provision an administrator, first create a normal account, then run `npm run promote-admin -- email@example.com` on a trusted machine with database access. Customer, worker, and admin dashboard pages enforce the matching role. Password reset and email confirmation are not implemented yet.

Authentication was checked against a temporary local MongoDB instance: customer and worker registration, bcrypt hashing, login, invalid-password rejection, CSRF handling, logout, session persistence, unverified-worker default, and role-specific dashboard access all passed. Atlas connectivity still requires your own connection string and network access configuration.

## Phase 1 structure

```text
public/                  Static frontend assets
  css/                   Responsive styles
  js/                    Browser-side JavaScript
src/
  config/                Environment, MongoDB, and session configuration
  controllers/           API request handlers
  middleware/            Shared request middleware
  models/                Mongoose data models
  routes/                REST API route definitions
  services/              Database and account operations
scripts/                 Trusted admin provisioning command
uploads/private/         Private upload storage; never served publicly
server.js                Connects services and starts Express
```

## Development sequence

Work through one phase at a time: structure and planning (complete), frontend layouts (complete), backend foundation (complete), database integration (complete; checked with a temporary local MongoDB), authentication and authorization (complete; key flows checked locally), core features, testing, and deployment preparation. Verification documents are represented by private storage metadata and remain excluded from normal queries. A worker is not verified at registration; only the later administrator approval flow should change that status.
