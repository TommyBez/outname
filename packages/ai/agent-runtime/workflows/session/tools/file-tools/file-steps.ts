import {
  getSystemSandbox,
  isMissingSystemSandboxError,
} from '@outname/ai/agent-runtime/server/agent-sandbox'
import { nonRetryableStepErrorFromUnknown } from '@outname/shared/server/workflow-step-errors'
import { grepLiveFiles } from '../sandbox-file-helpers/grep'
import { listLiveFiles } from '../sandbox-file-helpers/list'
import {
  assertWritableSandboxPath,
  FILE_TOOL_SANDBOX_ROOT,
  normalizeSandboxPath,
} from '../sandbox-file-helpers/paths'
import { readLiveFile } from '../sandbox-file-helpers/read'
import { ensureParentDirectories } from '../sandbox-file-helpers/write'

export async function readFileStep(args: {
  agentId: string
  path: string
}): Promise<unknown> {
  'use step'
  const sandbox = await getSystemSandboxForStep(args.agentId)
  const content = await readLiveFile(sandbox, args.path)
  if (content === null) {
    const safe = normalizeSandboxPath(args.path)
    return {
      content: null,
      error: `readFile: file not found: ${safe.relPath}`,
      exists: false,
    }
  }
  return { content }
}

export async function writeFileStep(args: {
  agentId: string
  content: string
  path: string
}): Promise<unknown> {
  'use step'
  const sandbox = await getSystemSandboxForStep(args.agentId)
  const safe = normalizeSandboxPath(args.path)
  assertWritableSandboxPath(safe)
  await ensureParentDirectories({
    paths: [safe.absPath],
    root: FILE_TOOL_SANDBOX_ROOT,
    sandbox,
  })
  await sandbox.writeFiles([
    {
      content: Buffer.from(args.content, 'utf8'),
      path: safe.absPath,
    },
  ])
  return { success: true }
}

export async function listFilesStep(
  agentId: string,
  input: { maxResults: number; pathPrefix: string }
): Promise<{ paths: string[]; truncated: boolean }> {
  'use step'
  const sandbox = await getSystemSandboxForStep(agentId)
  return await listLiveFiles(sandbox, input)
}

export async function grepFilesStep(
  agentId: string,
  input: {
    caseInsensitive: boolean
    fixedString: boolean
    maxResults: number
    pathPrefix: string
    pattern: string
  }
): Promise<{
  matches: Array<{ line: number; path: string; text: string }>
  truncated: boolean
}> {
  'use step'
  const sandbox = await getSystemSandboxForStep(agentId)
  return await grepLiveFiles(sandbox, input)
}

async function getSystemSandboxForStep(
  agentId: string
): Promise<Awaited<ReturnType<typeof getSystemSandbox>>> {
  try {
    return await getSystemSandbox(agentId)
  } catch (error) {
    if (isMissingSystemSandboxError(error, agentId)) {
      throw nonRetryableStepErrorFromUnknown(
        error,
        `system sandbox unavailable for agent "${agentId}"`
      )
    }
    throw error
  }
}
