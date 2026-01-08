# HTTPS Setup for Production (Backend & Frontend)

## 1. Generate SSL Certificates (Self-signed for test, or use real cert for prod)

### Self-signed (for test only):
```
openssl req -nodes -new -x509 -keyout server.key -out server.cert -days 365
```
Vendosi file-t `server.key` dhe `server.cert` në një folder p.sh. `backend/certs/`.

### Për prodhim:
- Përdor certifikatë të vërtetë nga Let's Encrypt, Cloudflare, ose CA tjetër.
- Vendosi file-t në `backend/certs/`.

## 2. Ndrysho backend/server.js për HTTPS
- Lexo certifikatën dhe përdor `https.createServer`.
- Opsionalisht, lejo HTTP vetëm për redirect në HTTPS.

## 3. Konfiguro frontend (Vite) për HTTPS
- Shto opsionin `https: true` ose jep path të certifikatave në vite.config.js.

## 4. Update .env
- Sigurohu që URL-t në .env të jenë me https.

## 5. Testo në browser: duhet të shfaqet ikonë e sigurt (🔒)

---

## Shembull për backend/server.js (HTTPS only)

```js
const fs = require('fs');
const https = require('https');
const express = require('express');
// ...existing code...

const app = express();
const sslOptions = {
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.cert')
};
const server = https.createServer(sslOptions, app);
// ...socket.io setup...

server.listen(PORT, () => {
  console.log(`Server running on https://localhost:${PORT}`);
});
```

---

## Shembull për vite.config.js (frontend)

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key: fs.readFileSync('./certs/server.key'),
      cert: fs.readFileSync('./certs/server.cert'),
    },
    port: 5174,
    host: true,
  },
});
```

---

## Kujdes!
- Mos i ngarko certifikatat në git!
- Për prodhim, përdor certifikatë të vërtetë.
- Testo që të gjitha request-et (API, websockets) shkojnë në https.
