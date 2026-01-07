# Udhëzim për Transmetim Live (RTMP/HLS)

1. Hap OBS Studio, Streamlabs ose Larix Broadcaster (mobile).
2. Vendos këto të dhëna:
   - **RTMP URL:** Merr nga faqja "Transmetimi yt Live" (p.sh. rtmp://your-server-ip:1935/live)
   - **Stream Key:** Merr nga faqja "Transmetimi yt Live"
3. Fillo transmetimin nga aplikacioni yt.
4. Shikuesit mund të shohin livestream në web/mobile me HLS URL (p.sh. http://your-server-ip:8080/hls/streamkey.m3u8)

**Shënim:**
- Për mobile streaming, përdor Larix Broadcaster (Android/iOS), vendos RTMP URL dhe stream key.
- Për desktop, përdor OBS ose Streamlabs.
- Për shikim në web, përdor komponentin StreamPlayer.jsx.

Nëse ke pyetje për konfigurim, më trego!
