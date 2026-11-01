#!/usr/bin/env bash
set -e

PORT="${ZS_HERMES_PORT:-17614}"

echo "================================================================="
echo " Starting Cloudflare Quick Tunnel for WebLlmBridge"
echo " Local Target: http://127.0.0.1:${PORT}"
echo "================================================================="

if ! command -v cloudflared &>/dev/null; then
    echo "Error: 'cloudflared' CLI is not installed."
    echo "Install it via your package manager or download from:"
    echo "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
fi

echo "Copy the https://*.trycloudflare.com URL below to your Hermes config.yaml"
echo "Example: https://xxxx-xxxx.trycloudflare.com/v1"
echo "-----------------------------------------------------------------"

cloudflared tunnel --url "http://127.0.0.1:${PORT}"
