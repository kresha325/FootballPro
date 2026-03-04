# Strategjia e Livestream për FootballPro (Rekomandimi: Hybrid)

Ky dokument përmbledh rekomandimin praktik për production: përdorim një qasje hybrid — mediasoup për sesionet interactive/private (paywalled) dhe restream në YouTube për reach publik.

Pse hybrid
- Mediasoup: low-latency WebRTC (interaktivitet real-time), kontroll i plotë mbi auth/monetization, i përshtatshëm për sesione pagese/qa/sponsors.
- YouTube: skalabilitet masiv, CDN/transcoding të paracaktuar, replay dhe discoverability për evente publike.
- Kombinimi: përdor mediasoup për pagesa/private, dhe automatikisht restream (via ffmpeg) në YouTube për reach.

Komponentët kryesorë (production minimal)
1. Backend (aktual): `backend/` — endpoints për start/end streams, metadata, viewer counts.
2. Media server (interactive): `mediasoup-server` (workers, router).
3. TURN server: `coturn` për NAT traversal.
4. RTMP ingest + HLS: `nginx-rtmp` ose `SRS` + `ffmpeg` për transcoding to HLS për shikues masivë.
5. Object storage: S3 (recordings) + CDN (CloudFront) për HLS/distribution.
6. Redis: locks, shared state, rate-limits.
7. Monitoring & logging: Prometheus/Grafana, centralized logs.
8. Security: HTTPS, JWT për broadcasters, `MEDIASOUP_ADMIN_TOKEN` për mediasoup-server.

Rrjedha e tipit "Go Live"
- Broadcaster (app) kërkon `getMyStreamInfo` → merr `streamKey` dhe endpoint RTMP (ose nis WebRTC signaling me mediasoup).
- Për interactive: përdor Socket.IO + mediasoup (createTransport → connectTransport → produce).
- Për restream publik: përdor `ffmpeg -re -i <webrtc/rtmp source> -c copy -f flv rtmp://a.rtmp.youtube.com/live2/<YOUTUBE_KEY>`
- Backend përditëson statusin stream (`isLive=true`) dhe emeton events (Socket.IO) te follower/clients.

Shembull i komandës `ffmpeg` për restream nga RTMP ingest në YouTube:

```bash
# Restream local file or RTMP ingest to YouTube Live
ffmpeg -re -i rtmp://localhost:1935/live/<streamKey> -c:v copy -c:a aac -b:a 128k -f flv rtmp://a.rtmp.youtube.com/live2/<YOUTUBE_STREAM_KEY>
```

Shembull i rrjedhës WebRTC → RTMP (opsion me ffmpeg):
- Përdor mediasoup për WebRTC (broadcaster). Për të marrë RTMP source mund të prodhosh një consumer/producer që shkon te ffmpeg (kërkon transcoding server-side) ose përdor një server si `Janus`/`SRS` me plugin për WebRTC→RTMP.

Minimal Docker Compose (shembull, vetë-testim)
- Për test lokal mund të përdorni containers: mediasoup-worker, coturn, nginx-rtmp, redis. (Kjo është shembullore; në prod përdorni autoscale dhe storage të jashtëm.)

Opsionet e implementimit (prioritetet)
1. MVP (shpejt):
   - Përdor RTMP ingest (`nginx-rtmp`) + OBS për broadcasters.
   - Përdor `ffmpeg` për restream në YouTube (manual ose automatizuar nga backend).
   - Kjo jep shpejt reach publik, pa vendosur mediasoup.
2. Full interactive (më i mirë për produktin):
   - Deploy mediasoup + coturn + Redis + nginx-rtmp.
   - Broadcaster mund të bëjë WebRTC për interaktivitet (chat, polls).
   - Për evente publike, restream nga RTMP ingest në YouTube.
3. Managed alternative (opsion operativ):
   - Përdorni LiveKit/Daily/Agora (managed WebRTC) për të shmangur menaxhimin e mediasoup.

Siguria & konfigurimet kritike
- Vendos `ANNOUNCED_IP` në mediasoup.
- Siguro portet UDP/TCP (media) dhe TURN.
- JWT tokens për broadcasters; `MEDIASOUP_ADMIN_TOKEN` për mediasoup-server të thjeshtëpai.
- Rate limits, auth checks në endpoint-et `start`/`end`.

Hapat praktikë për të ndezur production (rekomandim i shpejtë)
1. Vendos infrastruktura bazë: mediasoup-worker(s) + coturn + redis + nginx-rtmp + s3 + cdn.
2. Konfiguro env vars: `ANNOUNCED_IP`, `MEDIASOUP_ADMIN_TOKEN`, `FOOTBALLPRO_API_URL`, `RTMP_SERVER_IP`, `S3_*`.
3. Starto mediasoup + backend; test WebRTC local.
4. Shtoni ffmpeg script për restream në YouTube; test me një event të vogël.
5. Monitor & autoscale mediasoup workers sipas ngarkesës.

Rimarks për cost estimate (very rough)
- Lightsmall/VM per mediasoup worker: $20–60/mo (varësisht CPU/Network). Nevojiten disa workers për resiliency.
- TURN server (coturn): tregon përdorim të ulët, ~$5–20/mo.
- CDN + S3: varësisht trafik, për 1TB trafik: $40–100+/mo.
- Managed services (Agora/Daily): variojnë por mund të jenë më të shtrenjtë për orë të larta përdorimi.

Propozim i menjëhershëm që unë mund të bëj tani
- A: Shtoj në repo një `docker-compose.yml` minimal për `mediasoup` + `coturn` + `nginx-rtmp` + `redis` dhe skripte `ffmpeg` për restream. (Më pas ju mund ta vendosni në prod me ndryshime opsionale.)
- B: Shtoj backend endpoints për të gjeneruar/ruajtur YouTube stream keys dhe webhook handler për status.
- C: Përgatis plan detajuar i infrastrukturës me ports, commands dhe cost estimate më të hollësishëm.

Zgjidh: A, B, ose C — unë do ta aplikoj direkt.

---

(Shënim: dokumenti është një udhëzues praktik; më thoni nëse doni që të krijoj `docker-compose.yml` dhe skripte konkreta dhe i aplikoj në repo.)