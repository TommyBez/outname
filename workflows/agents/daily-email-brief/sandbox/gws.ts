import { eq } from "drizzle-orm"
import { Sandbox } from "@vercel/sandbox"
import { FatalError, RetryableError } from "workflow"
import { db } from "@/lib/db"
import { agent, gmailConnection } from "@/lib/db/schema"
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

const GWS_ENV: Record<string, string> = {
  GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE: GWS_CREDS_PATH,
  HOME: "/vercel/sandbox",
  PATH: "/vercel/sandbox:/usr/local/bin:/usr/bin:/bin",
}

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Result of running a gws command. Mirrors `{ exitCode, stdout, stderr }` —
 * raw and unopinionated so the agent can inspect / parse it however it
 * likes. Non-zero exit codes are returned verbatim, not thrown: the agent
 * decides how to react.
 */
export interface GwsResult {
  exitCode: number | null
  stdout: string
  stderr: string
}

/* -------------------------------------------------------------------------- */
/* Internal helpers (plain functions — no workflow directives)                */
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

async function readVersionMarker(sandbox: Sandbox): Promise<string | null> {
  const buf = await sandbox
    .readFileToBuffer({ path: GWS_VERSION_MARKER })
    .catch(() => null)
  return buf ? buf.toString("utf8").trim() : null
}

async function installGwsBinary(sandbox: Sandbox): Promise<void> {
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

  // Extract into a fresh subdirectory. --no-same-owner/-permissions so tar
  // doesn't try to chmod/utime the extraction dir (the sandbox user doesn't
  // own it).
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

async function readAgentSandboxName(agentId: string): Promise<string | null> {
  const [row] = await db
    .select({ sandboxName: agent.sandboxName })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  return row?.sandboxName ?? null
}

/* -------------------------------------------------------------------------- */
/* Step primitives                                                             */
/*                                                                             */
/* These MUST run as steps — they touch fetch-based APIs (Neon HTTP, Vercel    */
/* Sandbox) which are not available inside the "use workflow" sandboxed VM.   */
/* -------------------------------------------------------------------------- */

/**
 * Ensure the agent's persistent sandbox exists, gws is installed at the
 * pinned version, and the Gmail OAuth credentials are in place. Idempotent:
 * on subsequent runs the sandbox is resumed by name and the binary is kept.
 */
export async function installGws(opts: {
  agentId: string
  credentials: string
}): Promise<void> {
  "use step"
  const { sandbox } = await ensureAgentSandbox({
    agentId: opts.agentId,
    createOptions: { runtime: "node22", timeout: 180_000 },
    verify: async (sb) => (await readVersionMarker(sb)) === GWS_VERSION,
    provision: (sb) => installGwsBinary(sb),
  })
  await writeCredentials(sandbox, opts.credentials)
}

/**
 * Run a single gws command inside the agent's persistent sandbox. The
 * sandbox is resumed by name on every call — cheap once it has been booted
 * via `installGws`. Returns `{ exitCode, stdout, stderr }` raw so the
 * caller (the DurableAgent tool) can parse stdout however it wants.
 */
export async function runGws(opts: {
  agentId: string
  args: string[]
}): Promise<GwsResult> {
  "use step"
  const sandboxName = await readAgentSandboxName(opts.agentId)
  if (!sandboxName) {
    throw new FatalError(
      `Agent ${opts.agentId} has no sandbox yet — installGws must run first.`,
    )
  }
  const sandbox = await Sandbox.get({ name: sandboxName, resume: true })
  const cmd = await sandbox.runCommand({
    cmd: GWS_BIN_PATH,
    args: opts.args,
    env: GWS_ENV,
  })
  const [stdout, stderr] = await Promise.all([cmd.stdout(), cmd.stderr()])
  const result: GwsResult = { exitCode: cmd.exitCode, stdout, stderr }

  // Side effect: if the failure smells like OAuth, flip the stored
  // connection status so the UI can prompt for reconnect. The agent still
  // receives the raw result and can surface the error in its final reply.
  if (cmd.exitCode !== 0 && looksLikeAuthError(cmd.exitCode, stderr)) {
    await markConnectionExpired(stderr)
  }

  return result
}

/**
 * Graceful handoff: stop the sandbox so Vercel snapshots its filesystem
 * for the next resume. Best-effort — never fails the run.
 */
export async function closeGws(agentId: string): Promise<void> {
  "use step"
  const sandboxName = await readAgentSandboxName(agentId)
  if (!sandboxName) return
  try {
    const sandbox = await Sandbox.get({ name: sandboxName, resume: true })
    await releaseAgentSandbox(sandbox)
  } catch {
    /* ignore — nothing to snapshot */
  }
}
