#!/usr/bin/env bash
# Бір команда: сайт + достарға ашылатын HTTPS сілтеме (Cloudflare Tunnel).
# Қолдану:  ADMIN_PASSWORD=парольіңіз bash share.sh
set -e
cd "$(dirname "$0")"
PORT="${PORT:-3000}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD орнатыңыз. Мысалы: ADMIN_PASSWORD=baipket2026 bash share.sh}"
export PATH="$PWD/bin:$PATH"
if ! command -v cloudflared >/dev/null; then
  echo "cloudflared орнатылуда (бір рет)..."
  if command -v brew >/dev/null; then brew install cloudflared
  else
    A="amd64"; [ "$(uname -m)" = "arm64" ] && A="arm64"
    mkdir -p bin && curl -fL -o bin/cf.tgz "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-$A.tgz" && tar -xzf bin/cf.tgz -C bin && chmod +x bin/cloudflared
  fi
fi
LOG="$(mktemp)"
cloudflared tunnel --url "http://localhost:$PORT" >"$LOG" 2>&1 &
TP=$!
trap 'kill $TP 2>/dev/null || true' EXIT
URL=""
for i in $(seq 1 45); do
  URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "$URL" ]; then echo "Сілтеме алынбады. cloudflared жауабы:"; cat "$LOG"; exit 1; fi
echo ""
echo "============================================"
echo " Достарға жіберілетін сайт: $URL"
echo " Админ: $URL/admin"
echo "============================================"
PUBLIC_URL="$URL" PORT="$PORT" node server.mjs
