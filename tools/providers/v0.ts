import 'server-only'

import { v0ToolsByCategory } from '@v0-sdk/ai-tools'
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

type V0MutationLevel = 'read' | 'write' | 'destructive'
type V0ToolCategory = 'chat' | 'project' | 'deployment' | 'user' | 'hook'

const v0ConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(true)
    .describe(
      'When true, only non-mutating v0 operations are allowed. Set false to allow create, update, and delete operations.'
    ),
})

type V0ToolConfig = z.infer<typeof v0ConfigSchema>

interface V0SdkTool {
  execute?: (input: unknown) => Promise<unknown> | unknown
  inputSchema: z.ZodTypeAny
}

interface V0OperationDefinition {
  category: V0ToolCategory
  mutation: V0MutationLevel
  operation: string
  sdkTool: V0SdkTool
}

type V0RequestInput = Record<string, unknown> & { operation: string }

function inferMutation(operation: string): V0MutationLevel {
  if (operation.startsWith('get') || operation.startsWith('list')) {
    return 'read'
  }
  if (operation.startsWith('delete')) {
    return 'destructive'
  }
  return 'write'
}

function flattenV0Tools(
  toolGroups: Record<V0ToolCategory, Record<string, V0SdkTool>>
): V0OperationDefinition[] {
  const definitions: V0OperationDefinition[] = []
  for (const [category, group] of Object.entries(toolGroups)) {
    for (const [operation, sdkTool] of Object.entries(group)) {
      definitions.push({
        category: category as V0ToolCategory,
        mutation: inferMutation(operation),
        operation,
        sdkTool,
      })
    }
  }
  return definitions
}

const v0SchemaDefinitions = flattenV0Tools(
  v0ToolsByCategory({
    apiKey: V0_CONFIGURED_API_KEY_PLACEHOLDER,
  }) as Record<V0ToolCategory, Record<string, V0SdkTool>>
)

let cachedRuntimeTools: Record<string, V0SdkTool> | null = null

function getOperationDefinition(operation: string): V0OperationDefinition {
  const schemaDefinition = v0SchemaDefinitions.find(
    (definition) => definition.operation === operation
  )
  if (!schemaDefinition) {
    throw new Error(`Unknown v0 operation: ${operation}`)
  }
  return schemaDefinition
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
  v0SchemaDefinitions.map(({ operation, sdkTool }) =>
    asObjectSchema(sdkTool.inputSchema, operation).extend({
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
  const runtimeDefinitions = flattenV0Tools(
    v0ToolsByCategory({ apiKey }) as Record<
      V0ToolCategory,
      Record<string, V0SdkTool>
    >
  )
  cachedRuntimeTools = Object.fromEntries(
    runtimeDefinitions.map((definition) => [
      definition.operation,
      definition.sdkTool,
    ])
  ) as Record<string, V0SdkTool>
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
    const tool = tools[input.operation]
    if (typeof tool?.execute !== 'function') {
      return toolError(
        'unavailable',
        `The v0 SDK tool "${input.operation}" is unavailable.`
      )
    }

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
