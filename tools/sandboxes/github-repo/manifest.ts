import { defineSandboxManifest } from '../types'

export const githubRepoManifest = defineSandboxManifest({
  id: 'github-repo',
  displayName: 'github-repo',
  description:
    'Sandbox image with git, ripgrep, and supporting CLI utilities for repository-oriented maintainer tools.',
  version: 1,
  build: {
    runtime: 'node22',
    timeout: 600_000,
  },
})
