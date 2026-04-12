# MediaSoup E2E Checklist (Broadcaster + Viewer)

Ky checklist është për verifikim manual end-to-end pas deploy ose para release.

## 1) Parakushtet

- Backend server është online dhe i aksesueshëm.
- MediaSoup server është online dhe i aksesueshëm.
- Frontend është online dhe përdor URL-të e sakta në `.env`.
- `MEDIASOUP_ADMIN_TOKEN` është i njëjtë në backend dhe mediasoup-server.
- `FOOTBALLPRO_API_URL` në mediasoup-server tregon backend-in korrekt.
- `ANNOUNCED_IP` është vendosur me IP/domain publik.
- TURN server është i disponueshëm (rekomandohet për rrjete mobile/NAT).

## 2) Smoke Test i Nisjes

- Starto backend.
- Starto mediasoup-server.
- Thirr health endpoint:
  - `GET /api/mediasoup/health`
- Rezultati i pritur:
  - status `ok`
  - fusha `rooms` ekziston.

## 3) Broadcaster Flow

- Hyr me user A në frontend.
- Hape ekranin e live broadcast.
- Jep leje për kamerë/mikrofon.
- Starto live stream.
- Rezultati i pritur:
  - Socket lidhet pa error.
  - Room krijohet në mediasoup.
  - Producer audio/video krijohen.
  - Stream shfaqet si live në backend (`isLive=true`).

## 4) Viewer Flow

- Hyr me user B në frontend (browser/device tjetër).
- Hape stream-in live të user A.
- Starto viewing.
- Rezultati i pritur:
  - Viewer konsumon video dhe audio.
  - Figura dhe zëri shfaqen pa ndërprerje të menjëhershme.
  - Viewer count përditësohet në backend.

## 5) End Flow

- Mbyll live stream nga broadcaster (ose disconnect broadcaster).
- Rezultati i pritur:
  - Viewer merr event `streamEnded`.
  - Stream shënohet ended (`isLive=false`) në backend.
  - Viewer count bie sipas peers aktivë.
  - Room fshihet kur mbetet bosh.

## 6) Negative Tests

- Provo join pa token.
  - Pritet refuzim (`No token provided`/`Token invalid`).
- Provo `MEDIASOUP_ADMIN_TOKEN` gabim në mediasoup-server.
  - Pritet dështim i callback-eve për viewers/end (401).
- Provo start pa `MEDIASOUP_ADMIN_TOKEN`.
  - Pritet fail-fast në startup (server nuk niset).

## 7) Production Sanity

- CORS i kufizuar me origin real (`MEDIASOUP_CORS_ORIGIN`).
- TLS aktiv (frontend/backend/mediasoup prapa reverse proxy).
- Monitoring aktiv për:
  - count rooms
  - disconnect spikes
  - errors në callbacks (`viewers`, `end-internal`).

## 8) Kritere Kalimi

- Stream hapet dhe mbyllet pa ndërhyrje manuale në DB.
- Viewer count i stream-it përditësohet gjatë join/leave.
- Viewer merr audio + video.
- Nuk ka error kritik në logs gjatë testit.
