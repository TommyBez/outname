import type { z } from 'zod'
import type { ToolCapability, ToolResult } from '@/tools/catalog/types'
import type {
  BrokeredHttpRequest,
  BrokeredHttpResponse,
} from '../brokered-http/types'
import type { ToolRuntimeContext } from './runtime-context'

export type { ToolBuildContext } from '@/tools/catalog/types'
export type { ToolRuntimeContext } from './runtime-context'

export type PolicyResult = { ok: true } | { ok: false; message: string }

export type ToolPolicy<TInput, TConfig> = (input: {
  config: TConfig
  ctx: ToolRuntimeContext
  input: TInput
}) => PolicyResult

export interface ExecuteArgs<TInput, TConfig> {
  config: TConfig
  ctx: ToolRuntimeContext
  input: TInput
}

export type ExecuteResult<TData> =
  | Promise<ToolResult<TData>>
  | ToolResult<TData>

export interface DefineMaintainerToolArgs<TInput, TConfig, TData> {
  capabilities: ToolCapability[]
  category: string
  configSchema?: z.ZodType<TConfig, z.ZodTypeDef, unknown>
  description: string
  displayName: string
  execute(args: ExecuteArgs<TInput, TConfig>): ExecuteResult<TData>
  id: string
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>
  policies?: ToolPolicy<TInput, TConfig>[]
  sandboxManifestId?: string
}

export type ApiPassthroughToolArgs<TInput, TConfig, TData> = Omit<
  DefineMaintainerToolArgs<TInput, TConfig, TData>,
  'capabilities' | 'execute'
> & {
  handleResponse(
    response: BrokeredHttpResponse,
    input: ExecuteArgs<TInput, TConfig>
  ): Promise<ToolResult<TData>> | ToolResult<TData>
  provider: string
  toRequest(input: ExecuteArgs<TInput, TConfig>): BrokeredHttpRequest
}

export type SandboxToolArgs<TInput, TConfig, TData> = Omit<
  DefineMaintainerToolArgs<TInput, TConfig, TData>,
  'capabilities'
> & {
  manifestId: string
}
