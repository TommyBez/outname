/**
 * Phase 4: tool-sandbox manifest type.
 *
 * A manifest names a sandbox image that one or more maintainer tools
 * depend on. The sandbox is built once globally (per manifest version)
 * via `buildToolSandboxWorkflow` and reused by every tool call across
 * every user that has attached a tool requiring the manifest.
 *
 * The manifest itself is a static description (id, build params,
 * version). The shell script that actually installs system deps and
 * tool binaries is kept alongside the manifest in a TS module so its
 * bytes are bundled into the server runtime and can contribute to
 * `manifestHash` without any runtime FS reads.
 *
 * Naming convention: manifests are named after the **tool** they
 * enable, not after a system dependency. E.g. `agent-browser` rather
 * than `chromium` — the fact that the manifest installs Chromium libs
 * is an implementation detail of the manifest's setup script.
 */
export interface ToolSandboxManifest {
  /** `Sandbox.create` parameters used during the build. */
  build: {
    runtime: string
    /** Per-build wall clock budget in ms. */
    timeout: number
  }
  description: string
  /** Human label for logs / future catalog UI. */
  displayName: string
  /**
   * Stable id used as PK in `tool_sandbox_snapshots`, in
   * `agent_tools.tool_sandbox_manifest`, and as the lookup key the
   * runtime uses to spawn into a snapshot.
   */
  id: string
  /**
   * Optional runtime egress policy for commands executed from the built
   * snapshot. Use this when the sandbox needs brokered credentials
   * injected into outbound requests at call time.
   */
  runtimeNetwork?: {
    /**
     * Provider ids from `connections/registry.ts` whose credentials
     * should be injected outside the VM boundary for this sandbox.
     */
    brokeredProviders?: readonly string[]
    /**
     * Exact hosts that may be reached without injected headers.
     * Useful for public downloads or callbacks alongside authenticated
     * provider calls.
     */
    unauthenticatedHosts?: readonly string[]
  }
  /**
   * Bumped whenever the manifest's intent changes. The full descriptor
   * plus setup-script bytes drive rebuilds, so runtime/resource changes
   * also invalidate stale snapshots.
   */
  version: number
}

export function defineSandboxManifest(
  manifest: ToolSandboxManifest
): ToolSandboxManifest {
  return manifest
}
