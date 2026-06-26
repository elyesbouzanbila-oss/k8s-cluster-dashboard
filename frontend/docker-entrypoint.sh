#!/bin/sh
set -e

# ── Runtime env injection ──────────────────────────────────────────
# Vite embeds VITE_* vars at build time, but in K8s we set them at
# container start. Replace the build-time placeholder with the
# actual value so the frontend can authenticate with the backend.

API_KEY="${VITE_API_KEY:-}"

if [ -n "$API_KEY" ]; then
  echo "[entrypoint] Injecting VITE_API_KEY into built assets..."
  # Avoid BusyBox sed -i (broken in nginx:alpine) — use temp-file redirect
  for f in $(find /usr/share/nginx/html -type f \( -name '*.js' -o -name '*.html' \)); do
    sed "s|__VITE_API_KEY__|${API_KEY}|g" "$f" > "${f}.tmp" && mv "${f}.tmp" "$f"
  done
else
  echo "[entrypoint] WARNING: VITE_API_KEY is not set – API calls will fail."
fi

# Start nginx
exec nginx -g "daemon off;"
