#!/bin/bash
# Render build script
set -e

echo "Cleaning previous builds and caches..."
rm -rf dist node_modules/.vite client/.vite node_modules

echo "Installing dependencies with legacy peer deps (including dev dependencies for build tools)..."
npm ci --legacy-peer-deps --include=dev

echo "Building application with force flag..."
npm run build -- --force

echo "Build completed successfully!"
echo "Verifying build output..."
ls -lh dist/public/assets/css/
echo "Checking index.html..."
grep "index-" dist/public/index.html || echo "No CSS reference found in index.html"

echo "Verifying CSS was processed by Tailwind..."
if grep -q "@tailwind" dist/public/assets/css/*.css; then
    echo "ERROR: CSS file contains unprocessed @tailwind directives!"
    echo "This means Tailwind CSS was not properly compiled."
    exit 1
else
    echo "SUCCESS: CSS file was properly processed by Tailwind"
fi
