export const githubRepoSetupScript = String.raw`#!/usr/bin/env bash
set -euo pipefail

sudo dnf clean all
sudo dnf install -y --setopt=install_weak_deps=False \
  git \
  findutils \
  grep
`
