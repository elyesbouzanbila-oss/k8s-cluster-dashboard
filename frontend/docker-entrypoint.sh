#!/bin/sh
set -e

# API key has been removed from the frontend — authentication is handled
# by the nginx reverse proxy (same-origin) or an external authenticating proxy.
# No runtime env injection is needed.

exec nginx -g "daemon off;"
