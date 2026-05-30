#!/usr/bin/env bash
set -euo pipefail

BIN_DIR="${HOME}/.local/bin"
CHROME_DIR="${HOME}/.config/google-chrome/NativeMessagingHosts"
CHROMIUM_DIR="${HOME}/.config/chromium/NativeMessagingHosts"
SNAP_CHROMIUM_DIR="${HOME}/snap/chromium/common/chromium/NativeMessagingHosts"

HOST_NAME="com.github.abijey.browser_companion"
BIN_PATH="${BIN_DIR}/browser_companion_host"
MANIFEST_PATH="${CHROME_DIR}/${HOST_NAME}.json"
VERSION="0.2.0"
GIT_HASH="295217e"

echo "=== Browser Companion Installer ==="
echo "    v${VERSION} (${GIT_HASH})"
echo

mkdir -p "${BIN_DIR}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "${SCRIPT_DIR}/bin/browser_companion_host" ]; then
  cp "${SCRIPT_DIR}/bin/browser_companion_host" "${BIN_PATH}"
  chmod +x "${BIN_PATH}"
  echo "[OK] Installed binary: ${BIN_PATH}"
elif [ -f "${SCRIPT_DIR}/bin/opencode-native-host" ]; then
  cp "${SCRIPT_DIR}/bin/opencode-native-host" "${BIN_PATH}"
  chmod +x "${BIN_PATH}"
  echo "[OK] Installed binary (legacy name): ${BIN_PATH}"
else
  echo "[SKIP] Binary not found. Build with: bun run build"
fi

EXT_ID="${1:-}"
if [ -z "${EXT_ID}" ]; then
  echo
  echo "Usage: install.sh <chrome-extension-id>"
  echo
  echo "  1. Load the extension in Chrome (chrome://extensions -> Load unpacked -> select dist/)"
  echo "  2. Copy the extension ID from the card"
  echo "  3. Run: install.sh <extension-id>"
  exit 1
fi

mkdir -p "${CHROME_DIR}"
cat > "${MANIFEST_PATH}" <<JSON
{
  "name": "${HOST_NAME}",
  "description": "Browser companion native messaging host for MCP-compatible AI tools",
  "path": "${BIN_PATH}",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://${EXT_ID}/"]
}
JSON
echo "[OK] Registered manifest: ${MANIFEST_PATH}"

if [ -d "${HOME}/snap/chromium" ]; then
  mkdir -p "${SNAP_CHROMIUM_DIR}"
  cp "${MANIFEST_PATH}" "${SNAP_CHROMIUM_DIR}/"
  echo "[OK] Registered Snap Chromium manifest: ${SNAP_CHROMIUM_DIR}/${HOST_NAME}.json"
fi

# Remove old legacy manifest
rm -f "${CHROME_DIR}/com.opencode.app.json" "${CHROMIUM_DIR}/com.opencode.app.json" 2>/dev/null || true

echo
echo "=== Done ==="
echo
echo "  1. Restart Chrome"
echo "  2. Click the extension icon to connect"
echo "  3. Add to your MCP-compatible tool config:"
echo
echo '     {'
echo '       "mcp": {'
echo '         "browser": {'
echo '           "type": "remote",'
echo '           "url": "http://localhost:19877/mcp"'
echo '         }'
echo '       }'
echo '     }'
