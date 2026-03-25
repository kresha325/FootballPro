Mediasoup Production Deployment

This folder contains scripts and example configs to deploy a production Mediasoup signaling/worker server for FootballPro.

High-level steps

1. Provision a Linux VPS (Ubuntu 22.04 recommended) with a public IP.
2. Point a DNS name to the server (e.g. mediasoup.example.com).
3. Run the install script as root to install system deps and Node.
4. Configure `/etc/mediasoup.env` with your environment variables (see `.env.example`).
5. Configure `coturn` using `coturn.conf.example` and start coturn.
6. Configure Nginx with `nginx_mediasoup.conf` and obtain TLS certs (Let's Encrypt).
7. Open UDP port range (recommended 40000-49999) and TCP 443/80.
8. Start the `mediasoup` service and verify `/api/mediasoup/health`.

Notes
- You will need to set `ANNOUNCED_IP` to the server public IP or domain.
- Configure TURN (coturn) and supply credentials via env; without TURN, WebRTC may fail behind NATs.
- Adjust UDP port range to suit your firewall and provider.

Files
- `install_mediasoup.sh` — bootstrap script to install system deps and Node.
- `mediasoup.service` — systemd unit example.
- `nginx_mediasoup.conf` — nginx site config to proxy websocket signaling.
- `coturn.conf.example` — coturn sample config.
- `ufw_rules.sh` — ufw helper to open ports.
- `.env.example` — environment variables sample for mediasoup and app.
- `ffmpeg_to_youtube.sh` — example FFmpeg command for RTP->RTMP to YouTube (optional).

Usage
- Edit `.env.example` and copy to `/etc/mediasoup.env` (secure this file).
- Run `sudo bash install_mediasoup.sh` then `sudo systemctl daemon-reload` and `sudo systemctl start mediasoup`.
- Check `sudo journalctl -u mediasoup -f` for runtime logs.

If you want, I can adapt these files to your server provider (AWS/DigitalOcean) and create cloud-init or Ansible playbooks next.