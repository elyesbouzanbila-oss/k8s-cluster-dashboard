#!/bin/sh
set -e

# Runtime environment variable injection for Vite
# Vite bakes VITE_* vars at build time, so we inject them at runtime
# by replacing placeholders in the built JS files.

JS_DIR="/usr/share/nginx/html/assets"

if [ -d "$JS_DIR" ]; then
    # Replace VITE_API_URL placeholder
    if [ -n "$VITE_API_URL" ]; then
        echo "Injecting VITE_API_URL: $VITE_API_URL"
        find "$JS_DIR" -type f -name "*.js" -exec sed -i "s|__VITE_API_URL__|$VITE_API_URL|g" {} +
    fi

    # Replace VITE_API_KEY placeholder
    if [ -n "$VITE_API_KEY" ]; then
        echo "Injecting VITE_API_KEY"
        find "$JS_DIR" -type f -name "*.js" -exec sed -i "s|__VITE_API_KEY__|$VITE_API_KEY|g" {} +
    fi
fi

# Start nginx
exec nginx -g "daemon off;"
