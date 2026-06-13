import { type Tool, tool } from 'ai'
import { z } from 'zod'
import {
  grepFilesStep,
  listFilesStep,
  readFileStep,
  writeFileStep,
} from './file-tools/file-steps'

const MAX_LIST_RESULTS = 1000
const MAX_GREP_RESULTS = 200

export interface FileToolsContext {
  agentId: string
}

export function createFileTools(ctx: FileToolsContext): Record<string, Tool> {
  return {
    readFile: tool({
      description:
        'Read the contents of a file from the system sandbox. If the file does not exist, returns exists=false instead of failing.',
      inputSchema: z.object({
        path: z.string().describe('The path to the file to read'),
      }),
      execute: async ({ path }) => readFileStep({ agentId: ctx.agentId, path }),
    }),
    writeFile: tool({
      description:
        'Write content to a file in the system sandbox. Creates parent directories if needed.',
      inputSchema: z.object({
        content: z.string().describe('The content to write to the file'),
        path: z.string().describe('The path where the file should be written'),
      }),
      execute: async ({ content, path }) =>
        await writeFileStep({
          agentId: ctx.agentId,
          content,
          path,
        }),
    }),
    listFiles: tool({
      description:
        'List files in the persistent system sandbox. Paths are relative to /vercel/sandbox.',
      inputSchema: z.object({
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIST_RESULTS)
          .optional()
          .describe('Maximum number of paths to return. Defaults to 200.'),
        pathPrefix: z
          .string()
          .optional()
          .describe(
            "Optional relative or /vercel/sandbox path prefix, e.g. 'logs/' or 'projects/demo'."
          ),
      }),
      execute: async ({ maxResults, pathPrefix }) =>
        listFilesStep(ctx.agentId, {
          maxResults: maxResults ?? 200,
          pathPrefix: pathPrefix ?? '',
        }),
    }),
    grepFiles: tool({
      description:
        'Search text files in the persistent system sandbox with internal fixed-argv grep. No shell is exposed.',
      inputSchema: z.object({
        caseInsensitive: z
          .boolean()
          .optional()
          .describe('Use case-insensitive matching. Defaults to false.'),
        fixedString: z
          .boolean()
          .optional()
          .describe(
            'Treat pattern as a literal fixed string instead of an extended regular expression. Defaults to false.'
          ),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(MAX_GREP_RESULTS)
          .optional()
          .describe('Maximum number of matches to return. Defaults to 50.'),
        pathPrefix: z
          .string()
          .optional()
          .describe(
            "Optional relative or /vercel/sandbox path prefix to restrict search, e.g. 'logs/'."
          ),
        pattern: z
          .string()
          .min(1)
          .max(500)
          .describe(
            'Pattern to search. Uses grep -E by default; set fixedString=true for literal text.'
          ),
      }),
      execute: async ({
        caseInsensitive,
        fixedString,
        maxResults,
        pathPrefix,
        pattern,
      }) =>
        grepFilesStep(ctx.agentId, {
          caseInsensitive: caseInsensitive ?? false,
          fixedString: fixedString ?? false,
          maxResults: maxResults ?? 50,
          pathPrefix: pathPrefix ?? '',
          pattern,
        }),
    }),
  }
}
