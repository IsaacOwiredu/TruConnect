# TruConnect

TruConnect is a Ghana-focused directory that will help customers find skilled local service providers. **Phases 1–3 are complete. Phase 4's Mongoose integration is implemented and awaits a live Atlas connection check.** The account forms, profile data, and dashboards are interface previews; account services and live worker listings are planned for later phases.

## Architecture

- `public/` holds the framework-free HTML, CSS, and browser JavaScript served to users. Pages currently include the landing page, professional discovery and profile, login, registration, and customer, worker, and admin dashboard previews.
- `server.js` starts the Express application and mounts the API routes.
- `src/app.js` creates and configures the Express app; `src/config/env.js` loads and validates the port setting.
- `src/config/` contains shared configuration such as the database connection.
- `src/models/` contains Mongoose models and database relationships for users, workers, categories, verification requests, reviews, and reports.
- `src/services/` contains database operations used by controllers.
- `src/routes/` defines REST API endpoints; `src/controllers/` handles their request logic.
- `src/middleware/` holds reusable authentication, authorization, validation, and error handling.
- `src/utils/` contains shared server-side helpers.
- `uploads/private/` is reserved for sensitive verification files and must never be served as static content. Production storage and access controls will be addressed with the verification feature.

The browser communicates with the Express REST API. Express uses Mongoose to access MongoDB. Uploaded identity and verification documents are kept outside `public/` and will require authenticated, authorized access.

## Initial setup

Requirements: Node.js 20 or newer and a MongoDB connection string when database work begins. No database credentials are included in this repository.

```sh
npm install
```

Copy `.env.example` to `.env` when configuring a local environment, then set `MONGODB_URI` to your own MongoDB Atlas connection string. Add the development machine's IP address to the Atlas project's network access list and use a database user with only the permissions this application needs. Do not commit `.env` or share the connection string.

```sh
npm run dev
```

With no `MONGODB_URI`, the site starts in frontend-preview mode and database-backed API routes return `503`. With a URI configured, startup waits for MongoDB before listening. `GET /api/health` and `GET /api/v1/health` report liveness and database state; `GET /api/health/ready` and `GET /api/v1/health/ready` report readiness. `GET /api/v1/categories` returns active categories from MongoDB. Schemas use timestamps, references, validation, and query indexes. Development automatically builds indexes; production disables automatic index creation so indexes can be managed during deployment. The frontend is available at the server root; its search cards are sample interface data until live listing APIs are connected.

## Phase 1 structure

```text
public/                  Static frontend assets
  css/                   Responsive styles
  js/                    Browser-side JavaScript
src/
  config/                Environment and service configuration
  controllers/           API request handlers
  middleware/            Shared request middleware
  models/                Mongoose data models
  routes/                REST API route definitions
  utils/                 Shared backend helpers
uploads/private/         Private upload storage; never served publicly
server.js                Express application entry point
```

## Development sequence

Work through one phase at a time: structure and planning (complete), frontend layouts (complete), backend foundation (complete), database integration (implementation complete; connection check pending an Atlas URI), authentication, core features, testing, and deployment preparation. Verification documents are represented by private storage metadata and remain excluded from normal queries. A worker is not verified at registration; only the later administrator approval flow should change that status.
