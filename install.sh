#!/usr/bin/env bash
set -euo pipefail

BIN_DIR="${HOME}/.local/bin"
CHROME_DIR="${HOME}/.config/google-chrome/NativeMessagingHosts"
CHROMIUM_DIR="${HOME}/.config/chromium/NativeMessagingHosts"

HOST_NAME="com.opencode.app"
BIN_PATH="${BIN_DIR}/opencode-native-host"
MANIFEST_PATH="${CHROME_DIR}/${HOST_NAME}.json"

echo "=== OpenCode Browser Companion Installer ==="
echo

# Install binary
mkdir -p "${BIN_DIR}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "${SCRIPT_DIR}/opencode-native-host" ]; then
  cp "${SCRIPT_DIR}/opencode-native-host" "${BIN_PATH}"
  chmod +x "${BIN_PATH}"
  echo "[OK] Installed binary: ${BIN_PATH}"
else
  echo "[SKIP] Binary not found at ${SCRIPT_DIR}/opencode-native-host"
  echo "       Download it from the releases page or build with: bun run build"
fi

# Register native host manifest
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
  "description": "OpenCode browser companion native messaging host",
  "path": "${BIN_PATH}",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://${EXT_ID}/"]
}
JSON
echo "[OK] Registered manifest: ${MANIFEST_PATH}"

# Also try Chromium
if [ -d "${HOME}/.config/chromium" ]; then
  mkdir -p "${CHROMIUM_DIR}"
  cp "${MANIFEST_PATH}" "${CHROMIUM_DIR}/"
  echo "[OK] Registered Chromium manifest: ${CHROMIUM_DIR}/${HOST_NAME}.json"
fi

echo
echo "=== Done ==="
echo
echo "  1. Restart Chrome"
echo "  2. Click the extension icon to connect"
echo "  3. Add to your opencode.json:"
echo
echo '     {'
echo '       "mcp": {'
echo '         "browser": {'
echo '           "type": "remote",'
echo '           "url": "http://localhost:19877/mcp"'
echo '         }'
echo '       }'
echo '     }'
