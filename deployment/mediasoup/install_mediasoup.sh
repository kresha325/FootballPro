#!/usr/bin/env bash
# install_mediasoup.sh
# Run on a clean Ubuntu 22.04 server as root (or via sudo)
set -euo pipefail

echo "Updating apt and installing base packages..."
apt update && apt upgrade -y
apt install -y build-essential git curl ca-certificates gnupg lsb-release

# Node.js (LTS)
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs

# Media libs (FFmpeg optional)
apt install -y pkg-config libssl-dev libsrtp2-dev libavcodec-dev libavformat-dev libavutil-dev libavresample-dev ffmpeg

# coturn (install, can be left disabled until configured)
apt install -y coturn

# Create mediasoup system user
if ! id -u mediasoup >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin mediasoup
fi

# Expect repository checked out to /srv/mediasoup (you can change path)
TARGET_DIR=/srv/mediasoup
if [ ! -d "$TARGET_DIR" ]; then
  mkdir -p "$TARGET_DIR"
  chown mediasoup:mediasoup "$TARGET_DIR"
  echo "Created $TARGET_DIR — please deploy mediasoup server code here (or symlink your repo)."
fi

# Install npm deps (if package.json exists)
if [ -f "$TARGET_DIR/package.json" ]; then
  echo "Installing npm packages in $TARGET_DIR"
  cd "$TARGET_DIR"
  sudo -u mediasoup npm ci --production
fi

# Copy example env if missing
if [ ! -f /etc/mediasoup.env ]; then
  echo "Copying example env to /etc/mediasoup.env (please edit)"
  cat > /etc/mediasoup.env <<'EOF'
# Mediasoup env example — edit values
ANNOUNCED_IP=
VITE_MEDIASOUP_URL=
MEDIASOUP_ADMIN_TOKEN=
MEDIASOUP_PORT=4000
MEDIASOUP_WORKER_MIN_PORT=40000
MEDIASOUP_WORKER_MAX_PORT=49999
FOOTBALLPRO_API_URL=
TURN_URIS=
TURN_USER=
TURN_PASS=
EOF
  chmod 600 /etc/mediasoup.env
fi

# Install systemd unit
if [ ! -f /etc/systemd/system/mediasoup.service ]; then
  echo "Installing mediasoup.service (example)"
  cat > /etc/systemd/system/mediasoup.service <<'EOF'
[Unit]
Description=Mediasoup Signaling Server
After=network.target

[Service]
Type=simple
User=mediasoup
WorkingDirectory=/srv/mediasoup
EnvironmentFile=/etc/mediasoup.env
Restart=on-failure
RestartSec=5
ExecStart=/usr/bin/node server.js

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable mediasoup
fi

echo "Install complete. Edit /etc/mediasoup.env and place your mediasoup server code under $TARGET_DIR then start service with:"
echo "  sudo systemctl start mediasoup"
echo "Check logs: sudo journalctl -u mediasoup -f"
