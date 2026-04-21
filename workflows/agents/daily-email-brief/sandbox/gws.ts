import { Sandbox } from "@vercel/sandbox"
import { FatalError, RetryableError } from "workflow"
import { db } from "@/lib/db"
import { gmailConnection } from "@/lib/db/schema"
import {
  ensureAgentSandbox,
  releaseAgentSandbox,
} from "@/lib/agent-sandbox"

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

// Pinned version of gws. Bump deliberately after testing.
const GWS_VERSION = "0.22.5"
// x86_64 musl-linked build — statically linked, does NOT depend on host glibc.
// Vercel Sandbox runs on x86_64; the glibc-linked GNU build from the npm
// package requires GLIBC_2.39 which the sandbox image does not provide.
const GWS_TARBALL_URL = `https://github.com/googleworkspace/cli/releases/download/v${GWS_VERSION}/google-workspace-cli-x86_64-unknown-linux-musl.tar.gz`

// Everything below /vercel/sandbox is persisted across sandbox resumes.
const GWS_BIN_PATH = "/vercel/sandbox/gws"
const GWS_VERSION_MARKER = "/vercel/sandbox/.gws-version"
const GWS_CREDS_PATH = "/vercel/sandbox/gws-creds.json"

/* -------------------------------------------------------------------------- */
/* Auth-failure side effect                                                    */
/* -------------------------------------------------------------------------- */

function looksLikeAuthError(
  exitCode: number | null,
  stderr: string,
): boolean {
  const lower = (stderr ?? "").toLowerCase()
  return (
    lower.includes("invalid_grant") ||
    lower.includes("invalid_client") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("token has been expired or revoked") ||
    // gws structured exit code: 2 = auth error
    exitCode === 2
  )
}

/**
 * Best-effort: flip the stored Gmail connection to `expired` so the UI can
 * prompt reconnect. Swallows any DB error — the agent still sees the raw
 * gws result and can decide what to do.
 */
async function markConnectionExpired(stderr: string): Promise<void> {
  try {
    await db.update(gmailConnection).set({
      status: "expired",
      lastError: stderr.slice(0, 500),
      updatedAt: new Date(),
    })
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------------- */
/* Binary install helpers                                                      */
/* -------------------------------------------------------------------------- */

async function readVersionMarker(sandbox: Sandbox): Promise<string | null> {
  const buf = await sandbox
    .readFileToBuffer({ path: GWS_VERSION_MARKER })
    .catch(() => null)
  return buf ? buf.toString("utf8").trim() : null
}

async function installGwsBinary(
  sandbox: Sandbox,
  onProgress: ProgressFn,
): Promise<void> {
  await onProgress(`Installing gws ${GWS_VERSION}`)

  // Download the tarball OUTSIDE the sandbox so we don't need curl/wget in it.
  const tarballRes = await fetch(GWS_TARBALL_URL, { redirect: "follow" })
  if (!tarballRes.ok) {
    throw new RetryableError(
      `Failed to download gws ${GWS_VERSION}: ${tarballRes.status}`,
      { retryAfter: "30s" },
    )
  }
  const tarballBytes = Buffer.from(await tarballRes.arrayBuffer())

  await sandbox.writeFiles([
    { path: "/vercel/sandbox/gws.tar.gz", content: tarballBytes },
  ])

  // Extract into a fresh subdirectory. The release tarball is FLAT (gws
  // + docs at root, binary already executable). We pass
  // --no-same-owner --no-same-permissions -m so tar doesn't try to
  // chmod/utime the extraction dir itself (which the sandbox user does
  // not own).
  const extract = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-ec",
      `
rm -rf /vercel/sandbox/gws-extract
mkdir -p /vercel/sandbox/gws-extract
tar -xzf /vercel/sandbox/gws.tar.gz -C /vercel/sandbox/gws-extract --no-same-owner --no-same-permissions -m
if [ -f /vercel/sandbox/gws-extract/gws ]; then
  cp /vercel/sandbox/gws-extract/gws ${GWS_BIN_PATH}
else
  echo "gws binary not found at /vercel/sandbox/gws-extract/gws" >&2
  ls -la /vercel/sandbox/gws-extract >&2 || true
  exit 3
fi
chmod +x ${GWS_BIN_PATH}
rm -rf /vercel/sandbox/gws-extract /vercel/sandbox/gws.tar.gz
printf '%s' "${GWS_VERSION}" > ${GWS_VERSION_MARKER}
${GWS_BIN_PATH} --version
`,
    ],
  })

  if (extract.exitCode !== 0) {
    const [stderr, stdout] = await Promise.all([
      extract.stderr(),
      extract.stdout(),
    ])
    throw new FatalError(
      `gws install failed (exit ${extract.exitCode}). stderr: ${
        stderr.slice(0, 400) || "(empty)"
      } | stdout: ${stdout.slice(0, 400) || "(empty)"}`,
    )
  }
}

async function writeCredentials(
  sandbox: Sandbox,
  credentials: string,
): Promise<void> {
  // Rewritten per run — the refresh token may have been rotated.
  await sandbox.writeFiles([
    {
      path: GWS_CREDS_PATH,
      content: Buffer.from(credentials, "utf8"),
      mode: 0o600,
    },
  ])
}

/* -------------------------------------------------------------------------- */
/* GwsSession                                                                   */
/* -------------------------------------------------------------------------- */

type ProgressFn = (message: string) => Promise<void> | void

/**
 * Result of running a gws command. Mirrors `{ exitCode, stdout, stderr }`
 * — raw and unopinionated so the agent can inspect / parse it however it
 * likes. Non-zero exit codes are returned verbatim, not thrown: the agent
 * decides how to react.
 */
export interface GwsResult {
  exitCode: number | null
  stdout: string
  stderr: string
}

/**
 * A thin wrapper around a running Vercel Sandbox with gws staged and
 * authenticated. Exposes a single generic `run({ args })` — the agent is
 * in charge of which commands to invoke and how to parse the output.
 */
export class GwsSession {
  constructor(
    private readonly sandbox: Sandbox,
    private readonly env: Record<string, string>,
  ) {}

  async run(opts: { args: string[] }): Promise<GwsResult> {
    const cmd = await this.sandbox.runCommand({
      cmd: GWS_BIN_PATH,
      args: opts.args,
      env: this.env,
    })
    const [stdout, stderr] = await Promise.all([cmd.stdout(), cmd.stderr()])
    const result: GwsResult = { exitCode: cmd.exitCode, stdout, stderr }

    // Side effect: if the failure smells like OAuth, flip the stored
    // connection status so the UI can prompt for reconnect. The agent
    // still receives the raw result and can surface the error in its
    // final reply.
    if (cmd.exitCode !== 0 && looksLikeAuthError(cmd.exitCode, stderr)) {
      await markConnectionExpired(stderr)
    }

    return result
  }

  async close() {
    await releaseAgentSandbox(this.sandbox)
  }
}

/* -------------------------------------------------------------------------- */
/* createGwsSession                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Return a ready-to-use `GwsSession` for this agent. The underlying Vercel
 * Sandbox is persistent: on first use the gws binary is downloaded and
 * installed at `/vercel/sandbox/gws`; on subsequent runs the sandbox is
 * resumed from its snapshot and the binary is already in place (a version
 * marker file guards against stale installs after a gws upgrade).
 *
 * The Gmail OAuth credentials are always rewritten per-run — the refresh
 * token rotates.
 *
 * Callers are responsible for `await session.close()` (typically in a finally).
 */
export async function createGwsSession(opts: {
  agentId: string
  credentials: string
  onProgress?: ProgressFn
}): Promise<GwsSession> {
  const onProgress = opts.onProgress ?? (() => {})

  await onProgress("Opening agent sandbox")

  const { sandbox, created } = await ensureAgentSandbox({
    agentId: opts.agentId,
    createOptions: {
      runtime: "node22",
      timeout: 180_000,
    },
    verify: async (sb) => (await readVersionMarker(sb)) === GWS_VERSION,
    provision: (sb) => installGwsBinary(sb, onProgress),
  })

  try {
    if (created) {
      await onProgress("Provisioned new sandbox for this agent")
    }

    await writeCredentials(sandbox, opts.credentials)

    const env = {
      GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE: GWS_CREDS_PATH,
      HOME: "/vercel/sandbox",
      PATH: "/vercel/sandbox:/usr/local/bin:/usr/bin:/bin",
    }

    return new GwsSession(sandbox, env)
  } catch (err) {
    // Boot failed — release so the sandbox can snapshot, then propagate.
    await releaseAgentSandbox(sandbox)
    throw err
  }
}
