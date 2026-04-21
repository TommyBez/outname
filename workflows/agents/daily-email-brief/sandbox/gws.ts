import { Sandbox } from "@vercel/sandbox"
import { FatalError, RetryableError } from "workflow"
import { db } from "@/lib/db"
import { gmailConnection } from "@/lib/db/schema"
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
      cmd: "/tmp/gws",
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
      cmd: "/tmp/gws",
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
    try {
      await this.sandbox.stop()
    } catch {
      /* ignore */
    }
  }
}

/* -------------------------------------------------------------------------- */
/* createGwsSession                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Download the pinned musl build of gws, create a fresh Vercel Sandbox, stage
 * the binary + auth credentials, and return a ready-to-use GwsSession.
 *
 * Callers are responsible for `await session.close()` (typically in a finally).
 */
export async function createGwsSession(opts: {
  credentials: string
  onProgress?: ProgressFn
}): Promise<GwsSession> {
  const onProgress = opts.onProgress ?? (() => {})

  // Download the tarball OUTSIDE the sandbox so we don't need curl/wget in it.
  const tarballRes = await fetch(GWS_TARBALL_URL, { redirect: "follow" })
  if (!tarballRes.ok) {
    throw new RetryableError(
      `Failed to download gws ${GWS_VERSION}: ${tarballRes.status}`,
      { retryAfter: "30s" },
    )
  }
  const tarballBytes = Buffer.from(await tarballRes.arrayBuffer())

  await onProgress("Spinning up sandbox")

  const sandbox = await Sandbox.create({
    runtime: "node22",
    timeout: 180_000,
  })

  try {
    await sandbox.writeFiles([
      { path: "/tmp/gws.tar.gz", content: tarballBytes },
      {
        path: "/tmp/gws-creds.json",
        content: Buffer.from(opts.credentials, "utf8"),
      },
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
mkdir -p /tmp/gws-extract
tar -xzf /tmp/gws.tar.gz -C /tmp/gws-extract --no-same-owner --no-same-permissions -m
if [ -f /tmp/gws-extract/gws ]; then
  cp /tmp/gws-extract/gws /tmp/gws
else
  echo "gws binary not found at /tmp/gws-extract/gws" >&2
  ls -la /tmp/gws-extract >&2 || true
  exit 3
fi
chmod +x /tmp/gws
/tmp/gws --version
`,
      ],
    })

    if (extract.exitCode !== 0) {
      const [stderr, stdout] = await Promise.all([
        extract.stderr(),
        extract.stdout(),
      ])
      throw new FatalError(
        `gws extract failed (exit ${extract.exitCode}). stderr: ${
          stderr.slice(0, 400) || "(empty)"
        } | stdout: ${stdout.slice(0, 400) || "(empty)"}`,
      )
    }

    const env = {
      GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE: "/tmp/gws-creds.json",
      HOME: "/tmp",
      PATH: "/tmp:/usr/local/bin:/usr/bin:/bin",
    }

    return new GwsSession(sandbox, env)
  } catch (err) {
    // Boot failed — tear down the sandbox now so we don't leak.
    try {
      await sandbox.stop()
    } catch {
      /* ignore */
    }
    throw err
  }
}
