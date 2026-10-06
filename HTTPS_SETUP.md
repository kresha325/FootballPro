# TLS for FootballPro

Production TLS is terminated by the hosting layer (Render, Cloudflare, or the reverse proxy in front of the API). The Node process listens on HTTP. Do not load a private key inside `backend/server.js` for production.

## Local development

If a tool on your machine needs HTTPS, generate a certificate locally and keep it outside Git:

```bash
mkdir -p backend/certs
openssl req -nodes -new -x509 -keyout backend/certs/server.key -out backend/certs/server.cert -days 365 -subj "/CN=localhost"
```

Those files are development-only. `certs/`, `*.key`, and `*.pem` are gitignored. Do not commit a replacement private key.

## If the previously committed key was deployed

The repository previously contained `backend/certs/server.key` (a self-signed certificate for `CN=localhost`). The running API does not load that file. If that key was ever copied onto a public host, revoke or replace that certificate on the host and issue a new one from the hosting provider. History rewrite is required to purge the key from Git history; do not force-push until that is coordinated.
