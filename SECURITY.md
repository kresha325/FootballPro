# Security

## Reporting a vulnerability

Use GitHub private vulnerability reporting on this repository. Do not open a public issue, pull request, or chat message that includes an exploit, a token, or a customer record.

Include the affected path, what an attacker can do, and whether you confirmed it on a local checkout. Give the maintainers time to deploy a fix before any public write-up.

## Production environment

`NODE_ENV` must be `production` on the API host.

`JWT_SECRET` must be set to a long random value. The process throws on startup in production when it is missing. Do not reuse a secret that has appeared in git history.

`PAYMENTS_ENABLED` stays `false` until launch. Stripe keys alone do not turn card charges on.

`RUN_JOBS` defaults to on. Set it to `false` on every extra API instance so scheduled cleanup runs on one process only.

Schema changes go through `sequelize-cli db:migrate`. Do not run `backend/syncDatabase.js` in production. It refuses `sequelize.sync({ alter: true })` when `NODE_ENV=production`.

## Trust proxy

The API is deployed on Render behind exactly one proxy. `backend/server.js` sets `trust proxy` to `1`.

That value makes `req.ip` the client address the proxy appended, which is the rightmost `X-Forwarded-For` hop. Extra hops a client adds on the left are ignored, so they cannot rotate the address and skip the rate limiter.

Do not set `trust proxy` to `true`. That trusts the leftmost hop, which the client can choose.
