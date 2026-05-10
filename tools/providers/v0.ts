import 'server-only'
import { v0ToolsByCategory } from '@v0-sdk/ai-tools'
import { z } from 'zod'
import {
  defineActionTool,
  type ToolPolicy,
  toolError,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'

const MAX_STDOUT_BYTES = 256 * 1024
const MAX_STDERR_BYTES = 8 * 1024
const PROVIDER_ERROR_OUTPUT_LIMIT = 1000
const V0_AI_TOOLS_MANIFEST_ID = 'v0-ai-tools'

const sdkToolsByCategory = v0ToolsByCategory()

const V0_OPERATION_NAMES = [
  'createChat',
  'sendMessage',
  'getChat',
  'updateChat',
  'deleteChat',
  'favoriteChat',
  'forkChat',
  'listChats',
  'createProject',
  'getProject',
  'updateProject',
  'listProjects',
  'assignChatToProject',
  'getProjectByChat',
  'createEnvironmentVariables',
  'listEnvironmentVariables',
  'updateEnvironmentVariables',
  'deleteEnvironmentVariables',
  'createDeployment',
  'getDeployment',
  'deleteDeployment',
  'listDeployments',
  'getDeploymentLogs',
  'getDeploymentErrors',
  'getCurrentUser',
  'getUserBilling',
  'getUserPlan',
  'getUserScopes',
  'getRateLimits',
  'createHook',
  'getHook',
  'updateHook',
  'deleteHook',
  'listHooks',
] as const

const READ_ONLY_OPERATIONS = new Set<V0OperationName>([
  'getChat',
  'listChats',
  'getProject',
  'listProjects',
  'getProjectByChat',
  'listEnvironmentVariables',
  'getDeployment',
  'listDeployments',
  'getDeploymentLogs',
  'getDeploymentErrors',
  'getCurrentUser',
  'getUserBilling',
  'getUserPlan',
  'getUserScopes',
  'getRateLimits',
  'getHook',
  'listHooks',
])

type V0OperationName = (typeof V0_OPERATION_NAMES)[number]

interface SdkToolDefinition {
  description: string
  execute: (input: unknown) => Promise<unknown> | unknown
  inputSchema: z.ZodTypeAny
}

const SDK_OPERATION_CATALOG: Record<V0OperationName, SdkToolDefinition> = {
  createChat: readSdkToolDefinition(
    sdkToolsByCategory.chat.createChat,
    'createChat'
  ),
  sendMessage: readSdkToolDefinition(
    sdkToolsByCategory.chat.sendMessage,
    'sendMessage'
  ),
  getChat: readSdkToolDefinition(sdkToolsByCategory.chat.getChat, 'getChat'),
  updateChat: readSdkToolDefinition(
    sdkToolsByCategory.chat.updateChat,
    'updateChat'
  ),
  deleteChat: readSdkToolDefinition(
    sdkToolsByCategory.chat.deleteChat,
    'deleteChat'
  ),
  favoriteChat: readSdkToolDefinition(
    sdkToolsByCategory.chat.favoriteChat,
    'favoriteChat'
  ),
  forkChat: readSdkToolDefinition(sdkToolsByCategory.chat.forkChat, 'forkChat'),
  listChats: readSdkToolDefinition(
    sdkToolsByCategory.chat.listChats,
    'listChats'
  ),
  createProject: readSdkToolDefinition(
    sdkToolsByCategory.project.createProject,
    'createProject'
  ),
  getProject: readSdkToolDefinition(
    sdkToolsByCategory.project.getProject,
    'getProject'
  ),
  updateProject: readSdkToolDefinition(
    sdkToolsByCategory.project.updateProject,
    'updateProject'
  ),
  listProjects: readSdkToolDefinition(
    sdkToolsByCategory.project.listProjects,
    'listProjects'
  ),
  assignChatToProject: readSdkToolDefinition(
    sdkToolsByCategory.project.assignChatToProject,
    'assignChatToProject'
  ),
  getProjectByChat: readSdkToolDefinition(
    sdkToolsByCategory.project.getProjectByChat,
    'getProjectByChat'
  ),
  createEnvironmentVariables: readSdkToolDefinition(
    sdkToolsByCategory.project.createEnvironmentVariables,
    'createEnvironmentVariables'
  ),
  listEnvironmentVariables: readSdkToolDefinition(
    sdkToolsByCategory.project.listEnvironmentVariables,
    'listEnvironmentVariables'
  ),
  updateEnvironmentVariables: readSdkToolDefinition(
    sdkToolsByCategory.project.updateEnvironmentVariables,
    'updateEnvironmentVariables'
  ),
  deleteEnvironmentVariables: readSdkToolDefinition(
    sdkToolsByCategory.project.deleteEnvironmentVariables,
    'deleteEnvironmentVariables'
  ),
  createDeployment: readSdkToolDefinition(
    sdkToolsByCategory.deployment.createDeployment,
    'createDeployment'
  ),
  getDeployment: readSdkToolDefinition(
    sdkToolsByCategory.deployment.getDeployment,
    'getDeployment'
  ),
  deleteDeployment: readSdkToolDefinition(
    sdkToolsByCategory.deployment.deleteDeployment,
    'deleteDeployment'
  ),
  listDeployments: readSdkToolDefinition(
    sdkToolsByCategory.deployment.listDeployments,
    'listDeployments'
  ),
  getDeploymentLogs: readSdkToolDefinition(
    sdkToolsByCategory.deployment.getDeploymentLogs,
    'getDeploymentLogs'
  ),
  getDeploymentErrors: readSdkToolDefinition(
    sdkToolsByCategory.deployment.getDeploymentErrors,
    'getDeploymentErrors'
  ),
  getCurrentUser: readSdkToolDefinition(
    sdkToolsByCategory.user.getCurrentUser,
    'getCurrentUser'
  ),
  getUserBilling: readSdkToolDefinition(
    sdkToolsByCategory.user.getUserBilling,
    'getUserBilling'
  ),
  getUserPlan: readSdkToolDefinition(
    sdkToolsByCategory.user.getUserPlan,
    'getUserPlan'
  ),
  getUserScopes: readSdkToolDefinition(
    sdkToolsByCategory.user.getUserScopes,
    'getUserScopes'
  ),
  getRateLimits: readSdkToolDefinition(
    sdkToolsByCategory.user.getRateLimits,
    'getRateLimits'
  ),
  createHook: readSdkToolDefinition(
    sdkToolsByCategory.hook.createHook,
    'createHook'
  ),
  getHook: readSdkToolDefinition(sdkToolsByCategory.hook.getHook, 'getHook'),
  updateHook: readSdkToolDefinition(
    sdkToolsByCategory.hook.updateHook,
    'updateHook'
  ),
  deleteHook: readSdkToolDefinition(
    sdkToolsByCategory.hook.deleteHook,
    'deleteHook'
  ),
  listHooks: readSdkToolDefinition(
    sdkToolsByCategory.hook.listHooks,
    'listHooks'
  ),
}

const operationDescriptions = V0_OPERATION_NAMES.map(
  (operation) => `${operation}: ${SDK_OPERATION_CATALOG[operation].description}`
)

const v0OperationSchema = z.enum(V0_OPERATION_NAMES)

const v0AiToolsInputSchema = z.object({
  operation: v0OperationSchema.describe(
    `Official @v0-sdk/ai-tools operation to invoke. Available operations: ${operationDescriptions.join(' | ')}`
  ),
  input: z
    .record(z.unknown())
    .default({})
    .describe(
      'JSON object for the selected operation. It must match that operation’s official @v0-sdk/ai-tools input schema.'
    ),
  confirmIrreversible: z
    .boolean()
    .default(false)
    .describe(
      'Local safety confirmation. Set true for any create, update, delete, send, fork, favorite, assign, or environment-variable mutation.'
    ),
})

type V0AiToolsInput = z.infer<typeof v0AiToolsInputSchema>

const v0SafetyPolicy: ToolPolicy<V0AiToolsInput, Record<string, never>> = ({
  input,
}) => {
  if (READ_ONLY_OPERATIONS.has(input.operation)) {
    return { ok: true }
  }
  if (!input.confirmIrreversible) {
    return {
      ok: false,
      message: `Operation "${input.operation}" mutates v0 state and requires confirmIrreversible=true.`,
    }
  }
  return { ok: true }
}

export const v0AiToolsTool = defineActionTool({
  id: 'v0_ai_tools',
  category: 'deployment',
  displayName: 'v0 · AI Tools',
  description:
    'Run official @v0-sdk/ai-tools operations against the authenticated v0 Platform API. Supports chats, projects, deployments, user info, rate limits, and hooks.',
  capabilities: [
    { kind: 'brokered_http', provider: 'v0' },
    { kind: 'tool_sandbox', manifest: V0_AI_TOOLS_MANIFEST_ID },
  ],
  sandboxManifestId: V0_AI_TOOLS_MANIFEST_ID,
  inputSchema: v0AiToolsInputSchema,
  policies: [v0SafetyPolicy],
  async execute({ input, ctx }) {
    const sdkTool = SDK_OPERATION_CATALOG[input.operation]
    const validatedInput = sdkTool.inputSchema.safeParse(input.input)
    if (!validatedInput.success) {
      return toolError(
        'invalid_input',
        formatZodIssues(validatedInput.error.issues)
      )
    }

    const payload = Buffer.from(
      JSON.stringify(validatedInput.data),
      'utf8'
    ).toString('base64url')
    const result = await ctx.sandbox.run({
      cmd: 'v0-ai-tools-runner',
      args: [input.operation, payload],
      stdoutLimit: MAX_STDOUT_BYTES,
      stderrLimit: MAX_STDERR_BYTES,
      timeoutMs: 120_000,
    })
    if (result.timedOut) {
      return toolError('provider_error', result.stderr)
    }
    if (result.exitCode !== 0) {
      return toolError('provider_error', clippedOutput(result.stderr))
    }

    const raw = result.stdout.trim()
    if (!raw) {
      return toolSuccess({ operation: input.operation, result: null })
    }

    try {
      return toolSuccess({
        operation: input.operation,
        result: JSON.parse(raw) as unknown,
      })
    } catch {
      return toolError(
        'provider_error',
        'v0 runner returned a non-JSON response.'
      )
    }
  },
})

function readSdkToolDefinition(
  value: unknown,
  operation: V0OperationName
): SdkToolDefinition {
  if (!isSdkToolDefinition(value)) {
    throw new Error(
      `Published @v0-sdk/ai-tools operation "${operation}" does not expose the expected description/inputSchema/execute shape.`
    )
  }
  return value
}

function isSdkToolDefinition(value: unknown): value is SdkToolDefinition {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as {
    description?: unknown
    execute?: unknown
    inputSchema?: unknown
  }
  return (
    typeof candidate.description === 'string' &&
    candidate.inputSchema instanceof z.ZodObject &&
    typeof candidate.execute === 'function'
  )
}

function clippedOutput(output: string): string {
  const trimmed = output.trim()
  if (!trimmed) {
    return 'v0 request failed inside the sandbox.'
  }
  const truncated = trimmed.length > PROVIDER_ERROR_OUTPUT_LIMIT
  const suffix = truncated ? ' [truncated]' : ''
  return `v0 request failed: ${trimmed.slice(0, PROVIDER_ERROR_OUTPUT_LIMIT)}${suffix}`
}

function formatZodIssues(issues: z.ZodIssue[]): string {
  return issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ')
}
