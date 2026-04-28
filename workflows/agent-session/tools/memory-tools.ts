import { tool } from "ai"
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
import {
  isReadOnlyForAgent,
  READ_ONLY_TOOL_ERROR,
} from "./persona-paths"

/**
 * Build the memory toolset for an agent. The agent can:
 *
 *   - `list_memory`   — list every `*.md` memory file the system
 *     sandbox holds, including the special `AGENTS.md` and `SOUL.md`
 *     persona files that the agent itself authors.
 *   - `read_memory`   — read the effective content of one file (live
 *     state with this turn's queued ops overlayed on top, so the
 *     model sees its own writes immediately).
 *   - `write_memory`  — overwrite or create a file (queued; flushed
 *     at end of event).
 *   - `edit_memory`   — anchor-based edit; throws if `oldString`
 *     doesn't appear in the effective content.
 *   - `delete_memory` — remove a file (queued).
 *   - `search_memory` — overlay-aware regex grep across all memory
 *     files.
 *
 * Tool names follow the architect's `<verb>_memory` convention so the
 * doc and code agree.
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
    list_memory: tool({
      description:
        "List every memory file (relative paths, all ending in .md) the agent currently has. Reflects pending writes/deletes from this turn.",
      inputSchema: z.object({}),
      execute: async () => listMemoryStep(agentId, pending),
    }),

    read_memory: tool({
      description:
        "Read the effective content of a memory file. Returns the live on-disk content with this turn's queued writes/edits/deletes applied. Errors if the file does not exist.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("Relative path under the memory volume, e.g. 'journal.md'"),
      }),
      execute: async ({ path }) => readMemoryStep(agentId, pending, path),
    }),

    write_memory: tool({
      description:
        "Create or overwrite a memory file. The write is queued and applied at end of event; subsequent read_memory calls in the same turn see the new content.",
      inputSchema: z.object({
        path: z.string(),
        content: z
          .string()
          .describe("Full UTF-8 content of the file. Overwrites any prior."),
      }),
      execute: async ({ path, content }) => {
        const safe = validateMemoryPath(path)
        if (isReadOnlyForAgent(safe)) return READ_ONLY_TOOL_ERROR
        enqueueWrite(pending, safe, content)
        return { ok: true as const, path: safe, bytes: content.length }
      },
    }),

    edit_memory: tool({
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
        // Validate path eagerly so the read-only check fires before
        // we round-trip into a step.
        const safe = validateMemoryPath(path)
        if (isReadOnlyForAgent(safe)) return READ_ONLY_TOOL_ERROR
        return editMemoryStep(agentId, pending, {
          path: safe,
          oldString,
          newString,
          replaceAll: replaceAll ?? false,
        })
      },
    }),

    delete_memory: tool({
      description:
        "Delete a memory file. The deletion is queued and applied at end of event.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        const safe = validateMemoryPath(path)
        if (isReadOnlyForAgent(safe)) return READ_ONLY_TOOL_ERROR
        enqueueDelete(pending, safe)
        return { ok: true as const, path: safe }
      },
    }),

    search_memory: tool({
      description:
        "Search every memory file for matches of a regular expression. Returns up to 50 matches grouped by file with their line numbers and the matching line content. Overlay-aware: pending writes/edits/deletes from this turn are reflected in the search. Use this before read_memory when you don't know which file holds a fact.",
      inputSchema: z.object({
        pattern: z
          .string()
          .min(1)
          .max(500)
          .describe(
            "JavaScript regular expression source. Compiled with the 'm' flag plus any flags you provide. Anchored matches like '^- ' work line-by-line.",
          ),
        flags: z
          .string()
          .regex(/^[gimsuy]*$/)
          .optional()
          .describe(
            "Extra regex flags (subset of 'gimsuy'). 'i' is the most useful — case-insensitive. 'g' is implied; you don't need to pass it.",
          ),
        pathPrefix: z
          .string()
          .optional()
          .describe(
            "Restrict the search to files whose relative path starts with this prefix, e.g. 'logs/' or 'projects/'.",
          ),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Cap on total matches returned. Defaults to 50."),
      }),
      execute: async ({ pattern, flags, pathPrefix, maxResults }) =>
        searchMemoryStep(agentId, pending, {
          pattern,
          flags: flags ?? "",
          pathPrefix: pathPrefix ?? "",
          maxResults: maxResults ?? 50,
        }),
    }),
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
    throw new Error(`read_memory: file not found: ${path}`)
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
    throw new Error(`edit_memory: file not found: ${path}`)
  }
  const occurrences = countOccurrences(effective, args.oldString)
  if (occurrences === 0) {
    throw new Error(
      `edit_memory: oldString not found in ${path}. Provide a longer or more unique anchor.`,
    )
  }
  if (occurrences > 1 && !args.replaceAll) {
    throw new Error(
      `edit_memory: oldString matches ${occurrences} times in ${path}. Provide a unique anchor or set replaceAll=true.`,
    )
  }
  enqueueEdit(pending, path, args.oldString, args.newString, args.replaceAll)
  return {
    ok: true as const,
    path,
    replacements: args.replaceAll ? occurrences : 1,
  }
}

interface SearchMemoryArgs {
  pattern: string
  flags: string
  pathPrefix: string
  maxResults: number
}

interface SearchMatch {
  path: string
  line: number
  text: string
}

interface SearchResult {
  truncated: boolean
  matches: SearchMatch[]
}

async function searchMemoryStep(
  agentId: string,
  pending: PendingWrites,
  args: SearchMemoryArgs,
): Promise<SearchResult> {
  "use step"
  // Compile the regex up front so an invalid pattern fails before we
  // pull any sandbox content. The model sees the constructor's
  // SyntaxError verbatim, which is good enough — JS regex error
  // messages are usually self-explanatory.
  let re: RegExp
  try {
    // Always include 'g' for matchAll. Always include 'm' so '^' / '$'
    // anchors are line-scoped — the search is line-oriented anyway,
    // and the model expects per-line matching.
    const finalFlags = mergeFlags(args.flags, "gm")
    re = new RegExp(args.pattern, finalFlags)
  } catch (err) {
    throw new Error(
      `search_memory: invalid regex (${(err as Error).message}). Pass a JS-compatible pattern.`,
    )
  }

  const sandbox = await getSystemSandbox(agentId)
  const livePaths = await listLiveMemory(sandbox)
  const allPaths = resolveEffectiveListing(livePaths, pending)
  const candidates = args.pathPrefix
    ? allPaths.filter((p) => p.startsWith(args.pathPrefix))
    : allPaths

  // Read all candidate files in parallel — `listLiveMemory` returned
  // all *.md paths and we need the content of each. The sandbox SDK
  // serialises these internally, but issuing them at once still
  // beats one-at-a-time awaits.
  const fileContents = await Promise.all(
    candidates.map(async (path) => {
      const live = await readLiveMemory(sandbox, path)
      const effective = resolveEffectiveContent(path, live, pending)
      return [path, effective] as const
    }),
  )

  const matches: SearchMatch[] = []
  let truncated = false

  outer: for (const [path, content] of fileContents) {
    if (content === null) continue
    // Walk line-by-line so each match has a stable line number. We
    // could match against the whole file, but per-line is cheaper to
    // explain to the model and keeps the snippets tight.
    const lines = content.split("\n")
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? ""
      // Reset lastIndex when reusing the regex with /g across many
      // strings — without this, matchAll-style usage would silently
      // skip later lines.
      re.lastIndex = 0
      if (!re.test(line)) continue
      if (matches.length >= args.maxResults) {
        truncated = true
        break outer
      }
      matches.push({
        path,
        line: i + 1,
        // Trim absurdly long lines so a stray minified blob doesn't
        // blow the response payload.
        text: line.length > 240 ? `${line.slice(0, 240)}…` : line,
      })
    }
  }

  return { truncated, matches }
}

function mergeFlags(provided: string, required: string): string {
  const set = new Set([...provided, ...required])
  return Array.from(set).join("")
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
