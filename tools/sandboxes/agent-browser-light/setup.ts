export const agentBrowserLightSetupScript = String.raw`#!/usr/bin/env bash
# Tool sandbox setup script for the \`agent-browser-light\` manifest.
#
# Runs once inside a fresh Vercel Sandbox at build time; the resulting
# filesystem is captured as a snapshot and reused at every tool call.
# The script's bytes contribute to the manifest hash so any edit here
# triggers a rebuild on the next attach.
set -euo pipefail

# 1. Install Lightpanda and pin agent-browser to it for every invocation.
#    The official Lightpanda docs currently publish a Linux x86_64 binary.
LIGHTPANDA_INSTALL_PATH="/usr/local/bin/lightpanda"
LIGHTPANDA_DOWNLOAD_URL="https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-x86_64-linux"

if [ "$(uname -m)" != "x86_64" ]; then
  echo "agent-browser Lightpanda sandbox only supports x86_64 builds" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl must be available in the base sandbox image" >&2
  exit 1
fi

curl --fail --location --silent --show-error \
  "$LIGHTPANDA_DOWNLOAD_URL" \
  --output /tmp/lightpanda
chmod 0755 /tmp/lightpanda
sudo install -m 0755 /tmp/lightpanda "$LIGHTPANDA_INSTALL_PATH"
rm -f /tmp/lightpanda

# 2. Install the agent-browser CLI itself, but skip Chromium bootstrap.
npm install -g agent-browser

mkdir -p "$HOME/.agent-browser"
cat > "$HOME/.agent-browser/config.json" <<'EOF'
{
  "engine": "lightpanda",
  "executablePath": "/usr/local/bin/lightpanda"
}
EOF
`
