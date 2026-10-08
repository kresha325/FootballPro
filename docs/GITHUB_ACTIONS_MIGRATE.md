# Production Migrations

## Automatic (recommended, always on)

As of this change, `backend/package.json`'s `start` script runs
`npm run migrate:deploy` (i.e. `sequelize-cli db:migrate --env production`)
before starting the server (`node server.js`). Render (or any host) already
provides `DATABASE_URL` to the running process, so this requires **no extra
secrets or configuration** — every deploy/restart now applies any pending
migrations automatically before the server starts accepting traffic. If a
migration fails, the deploy fails loudly instead of running against a
stale/broken schema.

This is the primary safety net going forward. The GitHub Actions workflow
below is now optional/secondary.

## GitHub Actions: Production Migrations Workflow (optional)

This workflow allows running DB migrations against your production database via GitHub Actions,
independently of a deploy. It has been failing on every push because the required repository
Secrets were never configured — either configure the secrets below, or disable/remove the
workflow since the `start` script above now covers this automatically.

What it does
- Runs `npm ci` in `backend/` and executes `npx sequelize-cli db:migrate --env production` with DB credentials from Secrets.
- Performs a health check against `FOOTBALLPRO_API_URL/health`.

Required repository Secrets (add in Settings → Secrets):
- `PROD_PGHOST` — Postgres host
- `PROD_PGUSER` — Postgres user
- `PROD_PGPASSWORD` — Postgres password
- `PROD_PGDATABASE` — Postgres database name
- `PROD_PGPORT` — Postgres port (optional, default 5432)
- `FOOTBALLPRO_API_URL` — Public backend URL (used for health check)

Optional (if you want mediasoup health check or ffmpeg):
- `MEDIASOUP_HOST`, `MEDIASOUP_PORT`, `YOUTUBE_STREAM_KEY`

How to use
1. Add the required Secrets in GitHub repository settings.
2. Push to `main` or run the workflow manually via the Actions tab -> `Run production migrations` -> `Run workflow`.

Notes & Safety
- Always create a DB backup before running migrations in production.
- This workflow assumes your `backend` code contains a production `config` for `sequelize-cli`.
- If any step fails, the workflow will stop and report an error in Actions logs.
