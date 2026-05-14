import type { ToolExecutionOptions } from 'ai'
import { grepLiveFiles } from '../sandbox-file-helpers/grep'
import { listLiveFiles } from '../sandbox-file-helpers/list'
import { createSystemBashTool } from './system-bash-tool'

type BashToolExecutor<TInput> = (
  input: TInput,
  options: ToolExecutionOptions
) => Promise<unknown>

export async function readFileViaBashTool(args: {
  agentId: string
  options: ToolExecutionOptions
  path: string
}): Promise<unknown> {
  'use step'
  const bashTool = await createSystemBashTool({ agentId: args.agentId })
  const execute = bashTool.tools.readFile.execute as
    | BashToolExecutor<{ path: string }>
    | undefined
  if (!execute) {
    throw new Error('readFile tool execute handler is unavailable')
  }
  return await execute({ path: args.path }, args.options)
}

export async function writeFileViaBashTool(args: {
  agentId: string
  content: string
  options: ToolExecutionOptions
  path: string
}): Promise<unknown> {
  'use step'
  const bashTool = await createSystemBashTool({ agentId: args.agentId })
  const execute = bashTool.tools.writeFile.execute as
    | BashToolExecutor<{ content: string; path: string }>
    | undefined
  if (!execute) {
    throw new Error('writeFile tool execute handler is unavailable')
  }
  const toolResult = await execute(
    { content: args.content, path: args.path },
    args.options
  )
  return toolResult
}

export async function listFilesStep(
  agentId: string,
  input: { maxResults: number; pathPrefix: string }
): Promise<{ paths: string[]; truncated: boolean }> {
  'use step'
  const { getSystemSandbox } = await import(
    '@/agent-runtime/server/agent-sandbox'
  )
  const sandbox = await getSystemSandbox(agentId)
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
  const { getSystemSandbox } = await import(
    '@/agent-runtime/server/agent-sandbox'
  )
  const sandbox = await getSystemSandbox(agentId)
  return await grepLiveFiles(sandbox, input)
}
