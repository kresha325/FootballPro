#!/usr/bin/env bash
# ufw_rules.sh — open ports required for mediasoup
set -e

# Example variables
MEDIASOUP_TCP_PORT=4000
MEDIASOUP_UDP_MIN=40000
MEDIASOUP_UDP_MAX=49999

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow ${MEDIASOUP_TCP_PORT}/tcp
ufw allow proto udp from any to any port ${MEDIASOUP_UDP_MIN}:${MEDIASOUP_UDP_MAX}

ufw reload
ufw status verbose

echo "Opened TCP ${MEDIASOUP_TCP_PORT} and UDP ${MEDIASOUP_UDP_MIN}-${MEDIASOUP_UDP_MAX}"