// A manifest names a snapshot-backed sandbox image shared by every attachment
// that needs it. The setup script lives next to the manifest so its bytes feed
// `manifestHash`, and manifests are named after tools, not system packages.
export interface ToolSandboxManifest {
  build: {
    runtime: string
    timeout: number
  }
  description: string
  displayName: string
  id: string
  version: number
}

export function defineSandboxManifest(
  manifest: ToolSandboxManifest
): ToolSandboxManifest {
  return manifest
}
