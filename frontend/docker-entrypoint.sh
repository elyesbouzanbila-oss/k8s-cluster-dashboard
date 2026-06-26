#!/bin/sh
set -e

# ── Runtime env injection ──────────────────────────────────────────
# Vite embeds VITE_* vars at build time, but in K8s we set them at
# container start. Replace the build-time placeholder with the
# actual value so the frontend can authenticate with the backend.

API_KEY="${VITE_API_KEY:-}"

if [ -n "$API_KEY" ]; then
  echo "[entrypoint] Injecting VITE_API_KEY into built assets..."
  # Use perl for reliable in-place replacement (BusyBox sed -i is unreliable)
  find /usr/share/nginx/html -type f \( -name '*.js' -o -name '*.html' \) -exec \
    perl -pi -e "s/__VITE_API_KEY__/$ENV{VITE_API_KEY}/g" {} +
else
  echo "[entrypoint] WARNING: VITE_API_KEY is not set – API calls will fail."
fi

# Start nginx
exec nginx -g "daemon off;"
