import { defineSandboxManifest } from '../types'

export const githubRepoManifest = defineSandboxManifest({
  id: 'github-repo',
  displayName: 'github-repo',
  description:
    'Sandbox image with git and supporting CLI utilities for repository-oriented maintainer tools.',
  version: 2,
  build: {
    runtime: 'node22',
    timeout: 600_000,
  },
})
