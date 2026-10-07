# Propozim: access token i shkurtër dhe refresh token

Ky dokument është vetëm propozim. Nuk është i implementuar. Sot hyrja lëshon një JWT 7-ditor (`expiresIn: '7d'`) që ruhet në `localStorage` në web dhe në `expo-secure-store` në mobile. I njëjti token shkon te API si `Authorization: Bearer` dhe te Socket.IO si `handshake.auth.token`.

## Tokenat

- **Access token:** JWT 15 minuta. Përmban `user.id` dhe `tokenVersion`, si tani. Përdoret për API dhe për socket.
- **Refresh token:** vlerë e rastësishme, 32 byte, jo JWT. Ruhet e hash-uar në server, me skadencë 30 ditë, e lidhur me `userId` dhe `tokenVersion`. Rrotullohet në çdo përdorim: kodi i vjetër fshihet, lëshohet një i ri. Nëse përdoret një kod tashmë i fshirë, të gjitha sesionet e atij përdoruesi mbyllen (`tokenVersion` rritet).

`POST /api/auth/refresh` lexon refresh token-in, kontrollon hash-in dhe `tokenVersion`, pastaj kthen një access token të ri dhe një refresh token të ri. `POST /api/auth/logout` e fshin refresh token-in.

## Web

API-ja është `footballpro.onrender.com`, faqja është `xtalenti.com`. Janë site të ndryshme, prandaj cookie `SameSite=Lax` nuk dërgohet në `fetch` nga faqja te API-ja.

- Refresh token: cookie `HttpOnly`, `Secure`, `SameSite=None`, `Path=/api/auth`, `Max-Age` 30 ditë. Jo në `localStorage` dhe jo në JavaScript.
- Access token: vetëm në memorie (variabël e modulit). Nuk shkruhet në `localStorage`.
- CORS mbetet me origjinë të listuar (`https://xtalenti.com`) dhe `credentials: true`. Pa `Access-Control-Allow-Origin: *`.
- Çdo `fetch` i API-së përdor `credentials: 'include'`.
- CSRF: cookie është `SameSite=None`, prandaj një faqe tjetër mund ta dërgojë. Refresh-i pranon vetëm `POST` me header `X-Requested-With: xtalenti` (një faqe e huaj nuk mund ta vendosë këtë header në një kërkesë të thjeshtë) dhe origjinën e lejuar. Nuk vendoset një cookie e re pa atë kontroll.

Alternativë më e ngushtë: të njëjtin host për faqe dhe API (për shembull `xtalenti.com/api`). Atëherë cookie bëhet `SameSite=Lax` dhe `None` nuk duhet.

## Mobile

- Refresh token dhe access token ruhen në `expo-secure-store`, jo në AsyncStorage.
- Access token mund të qëndrojë edhe vetëm në memorie; në rinisje të app-it lexohet refresh token-i dhe kërkohet një access i ri.
- Cookie nuk përdoret. `POST /api/auth/refresh` merr refresh token-in në trup, sepse aplikacioni nuk është një shfletues.
- Push preferences mbeten siç janë, në SecureStore, të ndara nga token-i i hyrjes.

## Socket.IO

`backend/middleware/socketAuth.js` verifikon JWT-në në `handshake.auth.token` (ose header `Authorization`) dhe vendos `socket.userId`. Pa token, lidhja mbetet anonime për eventet publike.

Me access token 15-minutësh:

- Klienti dërgon access token-in aktual në handshake, jo refresh token-in.
- `socket.auth` bëhet funksion që kthen token-in e fundit, që riconnect të mos përdorë një token të skaduar.
- Kur serveri sheh `jwt expired`, e mbyll socket-in me një gabim të qartë. Klienti bën refresh, pastaj `socket.connect()` përsëri.
- Një lidhje e hapur nuk rinovohet vetë në mes të eventit. Handler-at që kontrollojnë `socket.userId` mbeten si tani. `tokenVersion` kontrollohet në handshake, si tani. Nëse përdoruesi del ose ndryshon fjalëkalimin, serveri e shkëput dhomën `user:<id>` pasi rritet `tokenVersion`.

Derisa ky propozim të implementohet, JWT 7-ditor mbetet i vlefshëm dhe OAuth e kthen atë vetëm përmes `POST /api/auth/oauth/exchange`, jo në URL.
