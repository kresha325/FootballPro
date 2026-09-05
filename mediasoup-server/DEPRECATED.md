# mediasoup-server — DEPRECATED

This standalone MediaSoup SFU is **legacy** and is no longer used by the primary
FootballPro go-live / viewer / call flows.

**Primary stack:** LiveKit (`/api/livekit`, `EmbedGoLive`, `LiveStreamViewer`, `VideoCallSimple`).

Do not deploy this service for new environments. It is kept temporarily only for
rollback reference and will be removed in a later cleanup once Render/deploy
configs no longer reference it.
