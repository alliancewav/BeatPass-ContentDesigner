#!/bin/bash
# Deploy Content Designer to Ghost theme assets (publicly accessible)
# Usage: bash deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
THEME_ASSETS="/home/beatpass-blog-ssh/htdocs/blog.beatpass.ca/content/themes/aspect/assets/content-designer"

echo "→ Building production bundle..."
cd "$SCRIPT_DIR"
npx vite build

echo "→ Deploying to Ghost theme assets..."
rm -rf "$THEME_ASSETS"
cp -r "$SCRIPT_DIR/dist" "$THEME_ASSETS"

echo "✓ Deployed to: https://blog.beatpass.ca/assets/content-designer/index.html"
