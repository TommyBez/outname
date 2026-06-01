import 'server-only'

import {
  defineToolBundle,
  type ToolRuntimeContext,
  toolError,
  toolSuccess,
} from '@outname/ai/tools/runtime/define-maintainer-tool'
import { clipProviderErrorMessage } from '@outname/ai/tools/runtime/define-maintainer-tool/provider-response'
import { readSdkCredentialResult } from '@outname/ai/tools/runtime/define-maintainer-tool/sdk-step'
import type { V0Credential } from '@outname/shared/connections/v0'
import { v0ToolsByCategory } from '@v0-sdk/ai-tools'
import { z } from 'zod'

const V0_CONFIGURED_API_KEY_PLACEHOLDER = 'schema-only-v0-api-key'
const V0_CONNECTOR_ID = 'v0.api_key'
const PROVIDER_ERROR_MESSAGE_LIMIT = 1000
const V0_ATTACHMENT_TOOL_ID = 'v0_platform'
const LEADING_CHARACTER_PATTERN = /^./
const CAMEL_CASE_BOUNDARY_PATTERN = /([a-z])([A-Z])/g

type V0MutationLevel = 'read' | 'write' | 'destructive'
type V0ToolCategory = 'chat' | 'project' | 'deployment' | 'user' | 'hook'
type V0CategoryEnabledFieldName = `enableGroup${string}`
type V0CategoryReadOnlyFieldName = `readOnlyGroup${string}`

interface V0SdkTool {
  description?: string
  execute?: (input: unknown) => Promise<unknown> | unknown
  inputSchema: z.ZodTypeAny
}

interface V0OperationDefinition {
  category: V0ToolCategory
  childToolId: string
  mutation: V0MutationLevel
  operation: string
  sdkTool: V0SdkTool
}

type V0ToolConfig = {
  readOnly: boolean
} & Partial<
  Record<V0CategoryEnabledFieldName | V0CategoryReadOnlyFieldName, boolean>
>

const CATEGORY_LABELS: Record<V0ToolCategory, string> = {
  chat: 'Chat',
  project: 'Project',
  deployment: 'Deployment',
  user: 'User',
  hook: 'Hook',
}

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

function toGroupEnabledFieldName(
  category: V0ToolCategory
): V0CategoryEnabledFieldName {
  return `enableGroup${CATEGORY_LABELS[category]}` as V0CategoryEnabledFieldName
}

function toGroupReadOnlyFieldName(
  category: V0ToolCategory
): V0CategoryReadOnlyFieldName {
  return `readOnlyGroup${CATEGORY_LABELS[category]}` as V0CategoryReadOnlyFieldName
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
  }) as unknown as Record<V0ToolCategory, Record<string, V0SdkTool>>
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
    ...Object.keys(CATEGORY_LABELS).flatMap((categoryKey) => {
      const category = categoryKey as V0ToolCategory
      const label = CATEGORY_LABELS[category]
      return [
        [
          toGroupEnabledFieldName(category),
          z
            .boolean()
            .default(true)
            .describe(
              `[Group: ${label}] Enable all ${label.toLowerCase()} resource tools in this group.`
            ),
        ],
        [
          toGroupReadOnlyFieldName(category),
          z
            .boolean()
            .default(true)
            .describe(
              `[Group: ${label}] When true, this ${label.toLowerCase()} resource group is read-only and blocks mutating operations.`
            ),
        ],
      ]
    }),
  ])
) as unknown as z.ZodType<V0ToolConfig>

function buildRuntimeTools(apiKey: string): Record<string, V0SdkTool> {
  const runtimeDefinitions = flattenV0Tools(
    v0ToolsByCategory({ apiKey }) as unknown as Record<
      V0ToolCategory,
      Record<string, V0SdkTool>
    >
  )
  return Object.fromEntries(
    runtimeDefinitions.map((definition) => [
      definition.childToolId,
      definition.sdkTool,
    ])
  ) as Record<string, V0SdkTool>
}

export async function executeV0Operation(args: {
  childToolId: string
  input: unknown
  operation: string
  toolConfig?: Record<string, unknown>
  userId: string
}) {
  'use step'
  // Export this step so the workflow transform registers it in the
  // deployment's step bundle.
  const credentialResult = await readSdkCredentialResult<V0Credential>({
    connectorId: V0_CONNECTOR_ID,
    toolConfig: args.toolConfig,
    userId: args.userId,
  })
  if (!credentialResult.ok) {
    return credentialResult.result
  }

  const tools = buildRuntimeTools(credentialResult.credential.apiKey)
  const runtimeTool = tools[args.childToolId]
  if (typeof runtimeTool?.execute !== 'function') {
    return toolError(
      'unavailable',
      `The v0 SDK tool "${args.childToolId}" is unavailable.`
    )
  }

  try {
    return toolSuccess(await runtimeTool.execute(args.input))
  } catch (error) {
    return toolError('provider_error', clipProviderError(args.operation, error))
  }
}

function clipProviderError(operation: string, error: unknown): string {
  return clipProviderErrorMessage(error, {
    bodyLimit: PROVIDER_ERROR_MESSAGE_LIMIT,
    label: `v0 ${operation}`,
  })
}

const v0BundleTools = Object.fromEntries(
  v0SchemaDefinitions.map((definition) => [
    definition.childToolId,
    {
      displayName: `v0 · ${humanizeOperation(definition.operation)}`,
      displayDescription: `Work with v0 ${humanizeOperation(definition.operation).toLowerCase()}.`,
      description:
        definition.sdkTool.description ??
        `Run the v0 ${humanizeOperation(definition.operation)} tool.`,
      inputSchema: definition.sdkTool.inputSchema,
      isEnabled(config: V0ToolConfig) {
        return config[toGroupEnabledFieldName(definition.category)] ?? true
      },
      policies:
        definition.mutation === 'read'
          ? undefined
          : [
              ({ config }: { config: V0ToolConfig }) =>
                config.readOnly ||
                (config[toGroupReadOnlyFieldName(definition.category)] ?? true)
                  ? {
                      ok: false as const,
                      message: `This v0 attachment blocks mutating ${CATEGORY_LABELS[definition.category].toLowerCase()} operations. Set readOnly=false and readOnlyGroup${CATEGORY_LABELS[definition.category]}=false to allow writes for this group.`,
                    }
                  : ({ ok: true } as const),
            ],
      async execute({
        ctx,
        input,
      }: {
        config: V0ToolConfig
        ctx: ToolRuntimeContext
        input: unknown
      }) {
        return await executeV0Operation({
          childToolId: definition.childToolId,
          input,
          operation: definition.operation,
          toolConfig: ctx.toolConfig,
          userId: ctx.userId,
        })
      },
    },
  ])
)

export const v0PlatformTool = defineToolBundle({
  id: V0_ATTACHMENT_TOOL_ID,
  category: 'deployment',
  displayName: 'v0 · Platform',
  displayDescription:
    'Create and manage v0 chats, projects, deployments, and webhooks.',
  description:
    'Attach the official v0 Platform AI SDK tools directly for chats, projects, deployments, user info, and webhooks. Defaults to read-only mode.',
  capabilities: [{ kind: 'sdk', connectorId: V0_CONNECTOR_ID }],
  configSchema: v0ConfigSchema,
  tools: v0BundleTools,
})
