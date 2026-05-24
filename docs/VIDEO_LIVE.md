# Video & Live — si funksionon (pas përfundimit)

## Rrugët e mbështetura

| Mënyra | Broadcaster | Shikuesi |
|--------|-------------|----------|
| **LiveKit** | Web Navbar, `/embed-go-live`, mobile WebView | `/live/:id` (web + mobile WebView) |
| **YouTube** | OBS / YouTube Studio (UC… në Settings) | Embed YouTube në `/live/:id` |
| **Regjistrim** | Upload skedar `/streams/upload-recording` | `videoUrl` + player (expo-av / HTML5) |

## Mobile

1. **Go Live** → krijon stream → hap **GoLiveBroadcast** (WebView `/embed-go-live?streamId=…`)
2. Token injektohet në `localStorage` (si thirrjet)
3. **Mbyll LIVE** → mesazh `goLiveEnded` → kthehet mbrapsht

## Konfigurim

- `WEB_APP_URL` — mobile + frontend deploy (p.sh. https://footballpro.al)
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` — transmetim kamerë në app (opsionale)
- Profil: `youtubeChannelId` (UC…) — kopjohet automatikisht në stream të ri

## Verifikim

```bash
curl https://footballpro.onrender.com/api/config/public
# livekitConfigured: true/false
```
