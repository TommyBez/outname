import 'server-only'

import { v0ToolsByCategory } from '@v0-sdk/ai-tools'
import { z } from 'zod'
import {
  defineToolBundle,
  toolError,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'

const V0_API_KEY_ENV_NAME = 'V0_API_KEY'
const V0_CONFIGURED_API_KEY_PLACEHOLDER = 'schema-only-v0-api-key'
const PROVIDER_ERROR_MESSAGE_LIMIT = 1000
const V0_ATTACHMENT_TOOL_ID = 'v0_platform'
const LEADING_CHARACTER_PATTERN = /^./
const CAMEL_CASE_BOUNDARY_PATTERN = /([a-z])([A-Z])/g

type V0MutationLevel = 'read' | 'write' | 'destructive'
type V0ToolCategory = 'chat' | 'project' | 'deployment' | 'user' | 'hook'
type V0EnabledFieldName = `enable${string}`

interface V0SdkTool {
  description?: string
  execute?: (input: unknown) => Promise<unknown> | unknown
  inputSchema: z.ZodTypeAny
}

interface V0OperationDefinition {
  category: V0ToolCategory
  childToolId: string
  enabledFieldName: V0EnabledFieldName
  mutation: V0MutationLevel
  operation: string
  sdkTool: V0SdkTool
}

type V0ToolConfig = {
  readOnly: boolean
} & Partial<Record<V0EnabledFieldName, boolean>>

function inferMutation(operation: string): V0MutationLevel {
  if (operation.startsWith('get') || operation.startsWith('list')) {
    return 'read'
  }
  if (operation.startsWith('delete')) {
    return 'destructive'
  }
  return 'write'
}

function humanizeOperation(operation: string): string {
  return operation
    .replace(CAMEL_CASE_BOUNDARY_PATTERN, '$1 $2')
    .replace(LEADING_CHARACTER_PATTERN, (character) => character.toUpperCase())
}

function toChildToolId(operation: string): string {
  return `v0_${operation}`
}

function toEnabledFieldName(operation: string): V0EnabledFieldName {
  return `enable${operation[0]?.toUpperCase() ?? ''}${operation.slice(1)}` as V0EnabledFieldName
}

function flattenV0Tools(
  toolGroups: Record<V0ToolCategory, Record<string, V0SdkTool>>
): V0OperationDefinition[] {
  const definitions: V0OperationDefinition[] = []
  for (const [category, group] of Object.entries(toolGroups)) {
    for (const [operation, sdkTool] of Object.entries(group)) {
      definitions.push({
        category: category as V0ToolCategory,
        childToolId: toChildToolId(operation),
        enabledFieldName: toEnabledFieldName(operation),
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

const v0ConfigSchema = z.object(
  Object.fromEntries([
    [
      'readOnly',
      z
        .boolean()
        .default(true)
        .describe(
          'When true, only non-mutating v0 operations are allowed. Set false to allow create, update, and delete operations.'
        ),
    ],
    ...v0SchemaDefinitions.map((definition) => [
      definition.enabledFieldName,
      z
        .boolean()
        .default(true)
        .describe(`Enable the ${definition.childToolId} child tool.`),
    ]),
  ])
) as unknown as z.ZodType<V0ToolConfig>

let cachedRuntimeTools: Record<string, V0SdkTool> | null = null

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
      definition.childToolId,
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

const v0BundleTools = Object.fromEntries(
  v0SchemaDefinitions.map((definition) => [
    definition.childToolId,
    {
      displayName: `v0 · ${humanizeOperation(definition.operation)}`,
      description:
        definition.sdkTool.description ??
        `Run the v0 ${humanizeOperation(definition.operation)} tool.`,
      inputSchema: definition.sdkTool.inputSchema,
      isEnabled(config: V0ToolConfig) {
        return config[definition.enabledFieldName] ?? true
      },
      policies:
        definition.mutation === 'read'
          ? undefined
          : [
              ({ config }: { config: V0ToolConfig }) =>
                config.readOnly
                  ? {
                      ok: false as const,
                      message:
                        'This v0 attachment is read-only. Set readOnly=false to allow create, update, and delete operations.',
                    }
                  : ({ ok: true } as const),
            ],
      async execute({
        input,
      }: {
        config: V0ToolConfig
        ctx: unknown
        input: unknown
      }) {
        const tools = getRuntimeTools()
        if (!tools) {
          return toolError(
            'unavailable',
            `${V0_API_KEY_ENV_NAME} is not configured on the server.`
          )
        }

        const runtimeTool = tools[definition.childToolId]
        if (typeof runtimeTool?.execute !== 'function') {
          return toolError(
            'unavailable',
            `The v0 SDK tool "${definition.childToolId}" is unavailable.`
          )
        }

        try {
          return toolSuccess(await runtimeTool.execute(input))
        } catch (error) {
          return toolError(
            'provider_error',
            clipProviderError(definition.operation, error)
          )
        }
      },
    },
  ])
)

export const v0PlatformTool = defineToolBundle({
  id: V0_ATTACHMENT_TOOL_ID,
  category: 'deployment',
  displayName: 'v0 · Platform',
  description:
    'Attach the official v0 Platform AI SDK tools directly for chats, projects, deployments, user info, and webhooks. Defaults to read-only mode.',
  capabilities: [{ kind: 'none' }],
  configSchema: v0ConfigSchema,
  tools: v0BundleTools,
})
