#!/usr/bin/env bash
set -euo pipefail

BIN_DIR="${HOME}/.local/bin"
HOST_NAME="com.github.abijey.browser_companion"
BIN_PATH="${BIN_DIR}/browser_companion_host"
VERSION="0.2.0"
HASH="$(git -C "$(dirname "$0")" rev-parse --short HEAD 2>/dev/null || echo "unknown")"

echo "=== Browser Companion Installer v${VERSION} (${HASH}) ==="
echo

# --- Install binary ---
mkdir -p "${BIN_DIR}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

for candidate in "${SCRIPT_DIR}/bin/browser_companion_host" "${SCRIPT_DIR}/browser_companion_host" "${SCRIPT_DIR}/bin/opencode-native-host"; do
  if [ -f "${candidate}" ]; then
    cp "${candidate}" "${BIN_PATH}"
    chmod +x "${BIN_PATH}"
    echo "[OK] Installed binary: ${BIN_PATH}"
    break
  fi
done

if [ ! -f "${BIN_PATH}" ]; then
  echo "[SKIP] Binary not found. Run: bun run build"
  echo
fi

# --- Register native host manifest ---
EXT_ID="${1:-}"
if [ -z "${EXT_ID}" ]; then
  echo "Usage: install.sh <extension-id>"
  echo "  Load extension in chromium://extensions, copy the ID from the card"
  exit 1
fi

BROWSER_DIRS=(
  "${HOME}/.config/google-chrome/NativeMessagingHosts"
  "${HOME}/.config/chromium/NativeMessagingHosts"
  "${HOME}/.config/google-chrome-for-testing/NativeMessagingHosts"
  "${HOME}/snap/chromium/common/chromium/NativeMessagingHosts"
  "${HOME}/snap/chromium/current/.config/chromium/NativeMessagingHosts"
  "${HOME}/.var/app/com.google.Chrome/config/google-chrome/NativeMessagingHosts"
)

INSTALLED=0
for dir in "${BROWSER_DIRS[@]}"; do
  if [ -d "$(dirname "${dir}")" ]; then
    mkdir -p "${dir}"
    # Snap Chromium can only access files under ~/snap/chromium/
    if [[ "${dir}" == *"/snap/chromium/"* ]]; then
      SNAP_BIN="${HOME}/snap/chromium/common/browser_companion_host"
      mkdir -p "$(dirname "${SNAP_BIN}")"
      cp "${BIN_PATH}" "${SNAP_BIN}" 2>/dev/null || true
      chmod +x "${SNAP_BIN}" 2>/dev/null || true
      HOST_PATH="${SNAP_BIN}"
    else
      HOST_PATH="${BIN_PATH}"
    fi
    cat > "${dir}/${HOST_NAME}.json" <<JSON
{
  "name": "${HOST_NAME}",
  "description": "Browser companion native messaging host for MCP-compatible AI tools",
  "path": "${HOST_PATH}",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://${EXT_ID}/"]
}
JSON
    echo "[OK] ${dir}/${HOST_NAME}.json -> ${HOST_PATH}"
    INSTALLED=$((INSTALLED + 1))
  fi
done

if [ $INSTALLED -eq 0 ]; then
  echo "[WARN] No Chromium/Chrome config directories found. Is a browser installed?"
fi

echo
echo "=== Done ==="
echo "  Restart your browser for changes to take effect."
echo
echo "  MCP config for AI tools:"
echo '    { "mcp": { "browser": { "type": "remote", "url": "http://localhost:19877/mcp" } } }'
