import { Sandbox } from "@vercel/sandbox"
import { createHash } from "node:crypto"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { agentFiles } from "@/lib/db/schema"
import {
  readAgentSandboxName,
  releaseAgentSandbox,
} from "@/lib/agent-sandbox"

/**
 * Workspace prefix that the agent owns. Everything markdown-y under
 * here (excluding hidden + sentinel files) is mirrored into
 * `agent_files` on every event so the UI can render the agent's notes
 * without having to resume the sandbox.
 *
 * Kept as a constant rather than per-kind config because Phase 1 only
 * has one agent kind; the path is the same as the persistent root.
 */
const SANDBOX_WORKSPACE_ROOT = "/vercel/sandbox"

/**
 * End-of-event handler.
 *
 *   1. Resume the agent's persistent sandbox by name.
 *   2. Enumerate every `*.md` file under `SANDBOX_WORKSPACE_ROOT`,
 *      excluding `node_modules`, hidden directories, and gws extract
 *      scratch dirs.
 *   3. Read each file, hash it, and upsert into `agent_files` keyed by
 *      `(agent_id, path)`. Unchanged files (matching sha256) are
 *      skipped to keep DB churn low.
 *   4. Stop the sandbox so Vercel snapshots the filesystem ready for
 *      the next event's resume.
 *
 * Failures inside this step never crash the session loop — they're
 * swallowed (with a log) so a transient sandbox or DB hiccup doesn't
 * prevent the agent from receiving the next event. The next event will
 * reflush the changed files anyway.
 */
export async function endOfEvent(input: { agentId: string }): Promise<void> {
  "use step"

  const name = await readAgentSandboxName(input.agentId)
  if (!name) return

  let sandbox: Sandbox | null = null
  try {
    sandbox = await Sandbox.get({ name, resume: true })
  } catch (err) {
    console.error("[v0] endOfEvent: sandbox.get failed", err)
    return
  }

  try {
    await flushMarkdown(sandbox, input.agentId)
  } catch (err) {
    console.error("[v0] endOfEvent: flush failed", err)
  } finally {
    await releaseAgentSandbox(sandbox)
  }
}

async function flushMarkdown(
  sandbox: Sandbox,
  agentId: string,
): Promise<void> {
  // Enumerate markdown files. `find` is GNU-compatible inside the
  // node22 sandbox image; we filter out hidden trees and node_modules
  // up front so we don't spend bytes on noise.
  const list = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-ec",
      `cd ${SANDBOX_WORKSPACE_ROOT} && find . -type f -name '*.md' \
        -not -path './.*' \
        -not -path './node_modules/*' \
        -not -path './gws-extract/*' \
        -print 2>/dev/null || true`,
    ],
  })
  const stdout = await list.stdout()
  const relPaths = stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith("./") ? p.slice(2) : p))
  if (relPaths.length === 0) return

  // Read existing hashes so we can skip unchanged files.
  const existing = await db
    .select({ path: agentFiles.path, sha256: agentFiles.sha256 })
    .from(agentFiles)
    .where(sql`${agentFiles.agentId} = ${agentId}`)
  const existingByPath = new Map(existing.map((r) => [r.path, r.sha256]))

  for (const relPath of relPaths) {
    const absPath = `${SANDBOX_WORKSPACE_ROOT}/${relPath}`
    const buf = await sandbox
      .readFileToBuffer({ path: absPath })
      .catch(() => null)
    if (!buf) continue

    const content = buf.toString("utf8")
    const sha = createHash("sha256").update(content).digest("hex")
    if (existingByPath.get(relPath) === sha) continue

    await db
      .insert(agentFiles)
      .values({
        agentId,
        path: relPath,
        content,
        sha256: sha,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [agentFiles.agentId, agentFiles.path],
        set: {
          content,
          sha256: sha,
          updatedAt: new Date(),
        },
      })
  }
}
