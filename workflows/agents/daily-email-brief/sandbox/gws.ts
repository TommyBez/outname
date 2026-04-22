import { Sandbox } from "@vercel/sandbox"
import { FatalError, RetryableError } from "workflow"
import { eq } from "drizzle-orm"
import { revalidateTag } from "next/cache"
import { gmailConnectionTag } from "@/lib/cache-tags"
import { db } from "@/lib/db"
import { gmailConnection } from "@/lib/db/schema"
import {
  readAgentSandboxName,
  readMarker,
  writeMarker,
  type SandboxSetup,
} from "@/lib/agent-sandbox"

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

// Pinned version of gws. Bump deliberately after testing.
const GWS_VERSION = "0.22.5"
// x86_64 musl-linked build — statically linked, does NOT depend on host
// glibc. Vercel Sandbox runs on x86_64; the glibc-linked GNU build from
// the npm package requires GLIBC_2.39 which the sandbox image does not
// provide.
const GWS_TARBALL_URL = `https://github.com/googleworkspace/cli/releases/download/v${GWS_VERSION}/google-workspace-cli-x86_64-unknown-linux-musl.tar.gz`

// Everything below /vercel/sandbox is persisted across sandbox resumes.
const GWS_BIN_PATH = "/vercel/sandbox/gws"
const GWS_VERSION_MARKER = "/vercel/sandbox/.gws-version"
const GWS_CREDS_PATH = "/vercel/sandbox/gws-creds.json"

const GWS_ENV: Record<string, string> = {
  GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE: GWS_CREDS_PATH,
  HOME: "/vercel/sandbox",
  PATH: "/vercel/sandbox:/usr/local/bin:/usr/bin:/bin",
}

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Result of running a gws command. Mirrors `{ exitCode, stdout, stderr }`
 * — raw and unopinionated so the agent can inspect / parse it however
 * it likes. Non-zero exit codes are returned verbatim, not thrown: the
 * agent decides how to react.
 */
export interface GwsResult {
  exitCode: number | null
  stdout: string
  stderr: string
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                            */
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
 * Best-effort: flip the stored Gmail connection to `expired` so the UI
 * can prompt reconnect. Swallows any DB error — the agent still sees
 * the raw gws result and can decide what to do.
 */
async function markConnectionExpired(stderr: string): Promise<void> {
  try {
    const [conn] = await db
      .select({ id: gmailConnection.id, userId: gmailConnection.userId })
      .from(gmailConnection)
      .limit(1)
    if (!conn) return

    await db
      .update(gmailConnection)
      .set({
        status: "expired",
        lastError: stderr.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(gmailConnection.id, conn.id))

    revalidateTag(gmailConnectionTag(conn.userId), "max")
  } catch {
    /* ignore */
  }
}

async function installGwsBinary(sandbox: Sandbox): Promise<void> {
  // Download the tarball OUTSIDE the sandbox so we don't need curl/wget
  // inside it.
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

  // Extract into a fresh subdirectory. --no-same-owner/-permissions so
  // tar doesn't try to chmod/utime the extraction dir (the sandbox user
  // doesn't own it). The version marker is written separately by the
  // setup hook via `writeMarker`, so there's a single source of truth.
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

/**
 * Build the gws-compatible credentials JSON blob from the stored Gmail
 * OAuth connection. Runs once per setup call — refresh tokens may have
 * rotated since the previous run.
 */
async function loadGwsCredentials(): Promise<string> {
  const [conn] = await db.select().from(gmailConnection).limit(1)
  if (!conn) {
    throw new FatalError(
      "Gmail is not connected. Go to /settings and click Connect Gmail.",
    )
  }
  if (conn.status !== "active") {
    throw new FatalError(
      `Gmail connection is ${conn.status}. Reconnect it in /settings.`,
    )
  }
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new FatalError(
      "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set",
    )
  }
  return JSON.stringify({
    type: "authorized_user",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: conn.refreshToken,
  })
}

/* -------------------------------------------------------------------------- */
/* Exported sandbox setup — consumed by lib/agent-sandbox-registry.ts         */
/* -------------------------------------------------------------------------- */

/**
 * Sandbox configuration for the daily-email-brief agent.
 *
 * `setup` is called on every startup (fresh create OR resume) and owns
 * its own idempotence: it re-installs the gws binary only when the
 * on-disk version marker is missing or stale, and always rewrites the
 * credentials blob so rotated refresh tokens take effect.
 */
export const gwsSandboxSetup: SandboxSetup = {
  createOptions: { runtime: "node22", timeout: 180_000 },
  async setup(sandbox) {
    // Idempotent binary install — marker check → install-if-stale.
    if ((await readMarker(sandbox, GWS_VERSION_MARKER)) !== GWS_VERSION) {
      await installGwsBinary(sandbox)
      await writeMarker(sandbox, GWS_VERSION_MARKER, GWS_VERSION)
    }
    // Rotate credentials every run. Cheap (one DB read + one file
    // write) and ensures the refresh token on disk is always current.
    const credentials = await loadGwsCredentials()
    await sandbox.writeFiles([
      {
        path: GWS_CREDS_PATH,
        content: Buffer.from(credentials, "utf8"),
        mode: 0o600,
      },
    ])
  },
}

/* -------------------------------------------------------------------------- */
/* Step primitive — consumed by the agent's `gws` tool                         */
/* -------------------------------------------------------------------------- */

/**
 * Run a single gws command inside the agent's persistent sandbox. The
 * sandbox is resumed by name on every call — cheap once startup has
 * booted it. Returns `{ exitCode, stdout, stderr }` raw so the DurableAgent
 * tool can parse stdout however it wants.
 */
export async function runGws(opts: {
  agentId: string
  args: string[]
}): Promise<GwsResult> {
  "use step"
  const name = await readAgentSandboxName(opts.agentId)
  if (!name) {
    throw new FatalError(
      `Agent ${opts.agentId} has no sandbox yet — startup must run first.`,
    )
  }
  const sandbox = await Sandbox.get({ name, resume: true })
  const cmd = await sandbox.runCommand({
    cmd: GWS_BIN_PATH,
    args: opts.args,
    env: GWS_ENV,
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
