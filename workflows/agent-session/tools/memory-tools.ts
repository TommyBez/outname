import { z } from "zod"
import { getSystemSandbox } from "@/lib/agent-sandbox"
import {
  enqueueDelete,
  enqueueEdit,
  enqueueWrite,
  listLiveMemory,
  readLiveMemory,
  resolveEffectiveContent,
  resolveEffectiveListing,
  validateMemoryPath,
  type PendingWrites,
} from "./pending-writes"

/**
 * Build the memory toolset for an agent. The agent can:
 *
 *   - `memory_list`  — list every `*.md` memory file the system
 *     sandbox holds, including the special `AGENTS.md` and `SOUL.md`
 *     persona files that the agent itself authors.
 *   - `memory_read`  — read the effective content of one file (live
 *     state with this turn's queued ops overlayed on top, so the
 *     model sees its own writes immediately).
 *   - `memory_write` — overwrite or create a file (queued; flushed at
 *     end of event).
 *   - `memory_edit`  — anchor-based edit; throws if `oldString`
 *     doesn't appear in the effective content.
 *   - `memory_delete`— remove a file (queued).
 *
 * The factory closes over the agent id and a per-event `PendingWrites`
 * so reads see a consistent overlay across all tool calls in the same
 * turn.
 */
export interface MemoryToolsContext {
  agentId: string
  pending: PendingWrites
}

export function createMemoryTools(ctx: MemoryToolsContext) {
  const { agentId, pending } = ctx

  return {
    memory_list: {
      description:
        "List every memory file (relative paths, all ending in .md) the agent currently has. Reflects pending writes/deletes from this turn.",
      inputSchema: z.object({}),
      execute: async () => {
        return await listMemoryStep(agentId, pending)
      },
    },

    memory_read: {
      description:
        "Read the effective content of a memory file. Returns the live on-disk content with this turn's queued writes/edits/deletes applied. Errors if the file does not exist.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("Relative path under the memory volume, e.g. 'journal.md'"),
      }),
      execute: async ({ path }) => {
        return await readMemoryStep(agentId, pending, path)
      },
    },

    memory_write: {
      description:
        "Create or overwrite a memory file. The write is queued and applied at end of event; subsequent memory_read calls in the same turn see the new content.",
      inputSchema: z.object({
        path: z.string(),
        content: z
          .string()
          .describe("Full UTF-8 content of the file. Overwrites any prior."),
      }),
      execute: async ({ path, content }) => {
        const safe = validateMemoryPath(path)
        enqueueWrite(pending, safe, content)
        return { ok: true as const, path: safe, bytes: content.length }
      },
    },

    memory_edit: {
      description:
        "Edit a memory file by replacing oldString with newString. Errors if oldString is not present in the effective content. Use replaceAll=true for global replacement; default replaces only the first occurrence.",
      inputSchema: z.object({
        path: z.string(),
        oldString: z
          .string()
          .min(1)
          .describe(
            "Exact substring to find. Must include enough surrounding context to be unique unless replaceAll is true.",
          ),
        newString: z.string().describe("Replacement text."),
        replaceAll: z.boolean().optional(),
      }),
      execute: async ({ path, oldString, newString, replaceAll }) => {
        return await editMemoryStep(agentId, pending, {
          path,
          oldString,
          newString,
          replaceAll: replaceAll ?? false,
        })
      },
    },

    memory_delete: {
      description:
        "Delete a memory file. The deletion is queued and applied at end of event.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        const safe = validateMemoryPath(path)
        enqueueDelete(pending, safe)
        return { ok: true as const, path: safe }
      },
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Steps — every sandbox round-trip is a step boundary                         */
/* -------------------------------------------------------------------------- */

async function listMemoryStep(
  agentId: string,
  pending: PendingWrites,
): Promise<{ paths: string[] }> {
  "use step"
  const sandbox = await getSystemSandbox(agentId)
  const livePaths = await listLiveMemory(sandbox)
  const effective = resolveEffectiveListing(livePaths, pending)
  return { paths: effective }
}

async function readMemoryStep(
  agentId: string,
  pending: PendingWrites,
  rawPath: string,
): Promise<{ path: string; content: string }> {
  "use step"
  const path = validateMemoryPath(rawPath)
  const sandbox = await getSystemSandbox(agentId)
  const live = await readLiveMemory(sandbox, path)
  const effective = resolveEffectiveContent(path, live, pending)
  if (effective === null) {
    throw new Error(`memory_read: file not found: ${path}`)
  }
  return { path, content: effective }
}

interface EditMemoryArgs {
  path: string
  oldString: string
  newString: string
  replaceAll: boolean
}

async function editMemoryStep(
  agentId: string,
  pending: PendingWrites,
  args: EditMemoryArgs,
): Promise<{ ok: true; path: string; replacements: number }> {
  "use step"
  const path = validateMemoryPath(args.path)
  const sandbox = await getSystemSandbox(agentId)
  const live = await readLiveMemory(sandbox, path)
  const effective = resolveEffectiveContent(path, live, pending)
  if (effective === null) {
    throw new Error(`memory_edit: file not found: ${path}`)
  }
  const occurrences = countOccurrences(effective, args.oldString)
  if (occurrences === 0) {
    throw new Error(
      `memory_edit: oldString not found in ${path}. Provide a longer or more unique anchor.`,
    )
  }
  if (occurrences > 1 && !args.replaceAll) {
    throw new Error(
      `memory_edit: oldString matches ${occurrences} times in ${path}. Provide a unique anchor or set replaceAll=true.`,
    )
  }
  enqueueEdit(pending, path, args.oldString, args.newString, args.replaceAll)
  return {
    ok: true as const,
    path,
    replacements: args.replaceAll ? occurrences : 1,
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0
  let count = 0
  let from = 0
  while (true) {
    const idx = haystack.indexOf(needle, from)
    if (idx === -1) break
    count += 1
    from = idx + needle.length
  }
  return count
}
