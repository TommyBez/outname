export const agentBrowserSetupScript = String.raw`#!/usr/bin/env bash
# Tool sandbox setup script for the \`agent-browser\` manifest.
#
# Runs once inside a fresh Vercel Sandbox at build time; the resulting
# filesystem is captured as a snapshot and reused at every tool call.
# The script's bytes contribute to the manifest hash so any edit here
# triggers a rebuild on the next attach.
set -euo pipefail

# 1. Chromium runtime libraries. agent-browser drives a real Chromium
#    binary under the hood, which needs the same shared libs Playwright
#    documents for Amazon Linux / Fedora-style images.
sudo dnf clean all
sudo dnf install -y --skip-broken \
  nss nspr libxkbcommon atk at-spi2-atk at-spi2-core \
  libXcomposite libXdamage libXrandr libXfixes libXcursor libXi libXtst \
  libXScrnSaver libXext mesa-libgbm libdrm mesa-libGL mesa-libEGL \
  cups-libs alsa-lib pango cairo gtk3 dbus-libs
sudo ldconfig

# 2. agent-browser CLI itself + its bundled Chromium.
npm install -g agent-browser
npx --yes agent-browser install
`
