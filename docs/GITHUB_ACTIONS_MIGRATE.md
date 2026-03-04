# GitHub Actions: Production Migrations Workflow

This workflow allows running DB migrations against your production database via GitHub Actions.

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
