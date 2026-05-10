import 'server-only'

import { v0Tools } from '@v0-sdk/ai-tools'
import { z } from 'zod'
import {
  defineActionTool,
  type ToolPolicy,
  toolError,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'

const V0_API_KEY_ENV_NAME = 'V0_API_KEY'
const V0_CONFIGURED_API_KEY_PLACEHOLDER = 'schema-only-v0-api-key'
const PROVIDER_ERROR_MESSAGE_LIMIT = 1000

const v0ConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(true)
    .describe(
      'When true, only non-mutating v0 operations are allowed. Set false to allow create, update, and delete operations.'
    ),
})

type V0ToolConfig = z.infer<typeof v0ConfigSchema>

type V0OperationCategory = 'chat' | 'project' | 'deployment' | 'user' | 'hook'

type V0MutationLevel = 'read' | 'write' | 'destructive'

interface V0SdkTool {
  description?: string
  execute?: (input: unknown) => Promise<unknown> | unknown
  inputSchema: z.ZodTypeAny
}

interface V0ExecutableTool extends V0SdkTool {
  execute: (input: unknown) => Promise<unknown> | unknown
}

interface V0OperationDefinition {
  category: V0OperationCategory
  mutation: V0MutationLevel
  operation: string
}

const V0_OPERATION_DEFINITIONS = [
  { operation: 'createChat', category: 'chat', mutation: 'write' },
  { operation: 'sendMessage', category: 'chat', mutation: 'write' },
  { operation: 'getChat', category: 'chat', mutation: 'read' },
  { operation: 'updateChat', category: 'chat', mutation: 'write' },
  { operation: 'deleteChat', category: 'chat', mutation: 'destructive' },
  { operation: 'favoriteChat', category: 'chat', mutation: 'write' },
  { operation: 'forkChat', category: 'chat', mutation: 'write' },
  { operation: 'listChats', category: 'chat', mutation: 'read' },
  { operation: 'createProject', category: 'project', mutation: 'write' },
  { operation: 'getProject', category: 'project', mutation: 'read' },
  { operation: 'updateProject', category: 'project', mutation: 'write' },
  { operation: 'listProjects', category: 'project', mutation: 'read' },
  {
    operation: 'assignChatToProject',
    category: 'project',
    mutation: 'write',
  },
  { operation: 'getProjectByChat', category: 'project', mutation: 'read' },
  {
    operation: 'createEnvironmentVariables',
    category: 'project',
    mutation: 'write',
  },
  {
    operation: 'listEnvironmentVariables',
    category: 'project',
    mutation: 'read',
  },
  {
    operation: 'updateEnvironmentVariables',
    category: 'project',
    mutation: 'write',
  },
  {
    operation: 'deleteEnvironmentVariables',
    category: 'project',
    mutation: 'destructive',
  },
  {
    operation: 'createDeployment',
    category: 'deployment',
    mutation: 'write',
  },
  { operation: 'getDeployment', category: 'deployment', mutation: 'read' },
  { operation: 'listDeployments', category: 'deployment', mutation: 'read' },
  {
    operation: 'deleteDeployment',
    category: 'deployment',
    mutation: 'destructive',
  },
  {
    operation: 'getDeploymentLogs',
    category: 'deployment',
    mutation: 'read',
  },
  {
    operation: 'getDeploymentErrors',
    category: 'deployment',
    mutation: 'read',
  },
  { operation: 'getCurrentUser', category: 'user', mutation: 'read' },
  { operation: 'getUserBilling', category: 'user', mutation: 'read' },
  { operation: 'getUserPlan', category: 'user', mutation: 'read' },
  { operation: 'getUserScopes', category: 'user', mutation: 'read' },
  { operation: 'getRateLimits', category: 'user', mutation: 'read' },
  { operation: 'createHook', category: 'hook', mutation: 'write' },
  { operation: 'getHook', category: 'hook', mutation: 'read' },
  { operation: 'updateHook', category: 'hook', mutation: 'write' },
  { operation: 'deleteHook', category: 'hook', mutation: 'destructive' },
  { operation: 'listHooks', category: 'hook', mutation: 'read' },
] as const satisfies readonly V0OperationDefinition[]

type V0OperationName = (typeof V0_OPERATION_DEFINITIONS)[number]['operation']

type V0RequestInput = Record<string, unknown> & {
  confirmIrreversible: boolean
  operation: V0OperationName
}

let cachedRuntimeTools: Record<string, V0SdkTool> | null = null

function createV0SdkToolBundle(apiKey: string): Record<string, V0SdkTool> {
  return v0Tools({ apiKey }) as unknown as Record<string, V0SdkTool>
}

const v0SchemaTools = createV0SdkToolBundle(V0_CONFIGURED_API_KEY_PLACEHOLDER)

function getOperationDefinition(
  operation: V0OperationName
): V0OperationDefinition {
  const definition = V0_OPERATION_DEFINITIONS.find(
    (candidate) => candidate.operation === operation
  )
  if (!definition) {
    throw new Error(`Unknown v0 operation: ${operation}`)
  }
  return definition
}

function getSdkTool(
  tools: Record<string, V0SdkTool>,
  operation: V0OperationName
): V0ExecutableTool {
  const tool = tools[operation]
  if (!tool || typeof tool.execute !== 'function') {
    throw new Error(`The v0 SDK does not expose the "${operation}" tool.`)
  }
  return tool as V0ExecutableTool
}

function asObjectSchema(
  schema: z.ZodTypeAny,
  operation: string
): z.AnyZodObject {
  if (!(schema instanceof z.ZodObject)) {
    throw new Error(`The v0 "${operation}" input schema must be a Zod object.`)
  }
  return schema
}

const v0RequestInputSchema = z.discriminatedUnion(
  'operation',
  V0_OPERATION_DEFINITIONS.map(({ operation }) =>
    asObjectSchema(
      getSdkTool(v0SchemaTools, operation).inputSchema,
      operation
    ).extend({
      operation: z.literal(operation),
      confirmIrreversible: z
        .boolean()
        .default(false)
        .describe(
          'Local safety confirmation flag. Required for mutating operations when the attachment is not read-only. This field is never sent to v0.'
        ),
    })
  ) as unknown as [
    z.ZodDiscriminatedUnionOption<'operation'>,
    ...z.ZodDiscriminatedUnionOption<'operation'>[],
  ]
) as unknown as z.ZodType<V0RequestInput>

const v0SafetyPolicy: ToolPolicy<V0RequestInput, V0ToolConfig> = ({
  input,
  config,
}) => {
  const definition = getOperationDefinition(input.operation)
  if (config.readOnly && definition.mutation !== 'read') {
    return {
      ok: false,
      message:
        'This v0 attachment is read-only. Set readOnly=false to allow create, update, and delete operations.',
    }
  }
  if (definition.mutation !== 'read' && !input.confirmIrreversible) {
    return {
      ok: false,
      message:
        'Mutating v0 operations require confirmIrreversible=true when readOnly is disabled.',
    }
  }
  return { ok: true }
}

function getRuntimeTools(): Record<string, V0SdkTool> | null {
  if (cachedRuntimeTools) {
    return cachedRuntimeTools
  }
  const apiKey = process.env[V0_API_KEY_ENV_NAME]
  if (!apiKey) {
    return null
  }
  cachedRuntimeTools = createV0SdkToolBundle(apiKey)
  return cachedRuntimeTools
}

function clipProviderError(operation: string, error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const normalizedMessage = rawMessage.replace(/\s+/g, ' ').trim()
  const clippedMessage =
    normalizedMessage.length > PROVIDER_ERROR_MESSAGE_LIMIT
      ? `${normalizedMessage.slice(0, PROVIDER_ERROR_MESSAGE_LIMIT)}…`
      : normalizedMessage
  return clippedMessage
    ? `v0 ${operation} failed: ${clippedMessage}`
    : `v0 ${operation} failed.`
}

function stripLocalFields(input: V0RequestInput): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key]) => key !== 'operation' && key !== 'confirmIrreversible'
    )
  )
}

export const v0RequestTool = defineActionTool({
  id: 'v0_request',
  category: 'deployment',
  displayName: 'v0 · Request',
  description:
    'Call official v0 Platform API tools through the @v0-sdk/ai-tools SDK for chats, projects, deployments, user info, and webhooks. Defaults to read-only mode.',
  capabilities: [{ kind: 'none' }],
  configSchema: v0ConfigSchema,
  inputSchema: v0RequestInputSchema,
  policies: [v0SafetyPolicy],
  async execute({ input, config }) {
    const tools = getRuntimeTools()
    if (!tools) {
      return toolError(
        'unavailable',
        `${V0_API_KEY_ENV_NAME} is not configured on the server.`
      )
    }

    const definition = getOperationDefinition(input.operation)
    const tool = getSdkTool(tools, input.operation)

    try {
      const result = await tool.execute(stripLocalFields(input))
      return toolSuccess({
        operation: definition.operation,
        category: definition.category,
        mutation: definition.mutation,
        readOnly: config.readOnly,
        result,
      })
    } catch (error) {
      return toolError(
        'provider_error',
        clipProviderError(definition.operation, error)
      )
    }
  },
})
