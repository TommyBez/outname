import { Sandbox } from "@vercel/sandbox"
import { FatalError, RetryableError } from "workflow"
import { db } from "@/lib/db"
import { gmailConnection } from "@/lib/db/schema"
import {
  ensureAgentSandbox,
  releaseAgentSandbox,
} from "@/lib/agent-sandbox"
import type { GmailApiMessage, GmailMessage } from "../types"

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
/* JSON helpers                                                                */
/* -------------------------------------------------------------------------- */

export function extractJson<T>(s: string): T | null {
  // gws emits clean structured JSON on stdout. Fall back to finding the first
  // balanced `{...}` or `[...]` in case any banner text slips through.
  const trimmed = s.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as T
  } catch {
    /* fall through */
  }
  const firstBrace = Math.min(
    ...[trimmed.indexOf("{"), trimmed.indexOf("[")].filter((i) => i >= 0),
  )
  if (!Number.isFinite(firstBrace)) return null
  const candidate = trimmed.slice(firstBrace)
  try {
    return JSON.parse(candidate) as T
  } catch {
    return null
  }
}

export function normalizeGmail(msg: GmailApiMessage): GmailMessage {
  const headers = msg.payload?.headers ?? []
  const header = (n: string) =>
    headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? ""
  const dateStr = header("Date")
  const receivedAt = dateStr
    ? new Date(dateStr)
    : new Date(Number(msg.internalDate ?? Date.now()))
  return {
    id: msg.id,
    threadId: msg.threadId ?? msg.id,
    subject: header("Subject") || "(no subject)",
    from: header("From") || "unknown",
    snippet: msg.snippet ?? "",
    receivedAt: isNaN(receivedAt.getTime())
      ? new Date().toISOString()
      : receivedAt.toISOString(),
  }
}

/* -------------------------------------------------------------------------- */
/* Failure classification                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Translate a non-zero gws exit into either a FatalError (auth / unrecoverable)
 * or a RetryableError (transient API glitch). Also marks the stored Gmail
 * connection as `expired` so the UI can prompt the user to reconnect.
 */
export async function handleGwsFailure(
  exitCode: number | null,
  stderr: string,
): Promise<never> {
  const lower = (stderr ?? "").toLowerCase()
  const isAuth =
    lower.includes("invalid_grant") ||
    lower.includes("invalid_client") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("credentials") ||
    lower.includes("token has been expired or revoked") ||
    // gws structured exit code: 2 = auth error
    exitCode === 2

  if (isAuth) {
    // Best-effort: flip the stored connection so the UI prompts reconnect.
    try {
      await db
        .update(gmailConnection)
        .set({
          status: "expired",
          lastError: stderr.slice(0, 500),
          updatedAt: new Date(),
        })
    } catch {
      /* ignore */
    }
    throw new FatalError(
      `Gmail auth failed (exit ${exitCode}). Reconnect in /settings. Details: ${stderr.slice(
        0,
        500,
      )}`,
    )
  }

  throw new RetryableError(
    `gws failed (exit ${exitCode}): ${stderr.slice(0, 500)}`,
    { retryAfter: "30s" },
  )
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

interface ListParams {
  userId: string
  q: string
  maxResults: number
}

/**
 * A thin wrapper around a running Vercel Sandbox with the gws binary staged
 * and authenticated. Steps use this so they don't need to know anything about
 * tarballs, file staging, or shell commands.
 */
export class GwsSession {
  constructor(
    private readonly sandbox: Sandbox,
    private readonly env: Record<string, string>,
  ) {}

  async listMessages(
    params: Omit<ListParams, "userId"> & Partial<Pick<ListParams, "userId">>,
  ): Promise<{ messages: { id: string; threadId: string }[] }> {
    const listParams = JSON.stringify({
      userId: params.userId ?? "me",
      q: params.q,
      maxResults: params.maxResults,
    })
    const list = await this.sandbox.runCommand({
      cmd: GWS_BIN_PATH,
      args: ["gmail", "users", "messages", "list", "--params", listParams],
      env: this.env,
    })

    if (list.exitCode !== 0) {
      const stderr = await list.stderr()
      await handleGwsFailure(list.exitCode, stderr)
    }

    const stdout = await list.stdout()
    const parsed = extractJson<{
      messages?: { id: string; threadId: string }[]
    }>(stdout)
    if (!parsed) {
      const stderr = await list.stderr()
      throw new FatalError(
        `Unable to parse gws list output. stderr: ${stderr.slice(0, 500)}`,
      )
    }
    return { messages: parsed.messages ?? [] }
  }

  async getMessageMetadata(
    id: string,
    headers: string[] = ["From", "Subject", "Date"],
  ): Promise<GmailApiMessage | null> {
    const getParams = JSON.stringify({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: headers,
    })
    const get = await this.sandbox.runCommand({
      cmd: GWS_BIN_PATH,
      args: ["gmail", "users", "messages", "get", "--params", getParams],
      env: this.env,
    })
    if (get.exitCode !== 0) {
      const stderr = await get.stderr()
      await handleGwsFailure(get.exitCode, stderr)
    }
    const raw = await get.stdout()
    return extractJson<GmailApiMessage>(raw)
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
