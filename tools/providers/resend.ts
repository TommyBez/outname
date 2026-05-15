import 'server-only'
import { z } from 'zod'
import {
  defineToolBundle,
  type ToolRuntimeContext,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'
import {
  parseProviderResponseFromHttp,
  toolErrorFromProviderResponse,
} from '@/tools/runtime/define-maintainer-tool/provider-response'

const RESEND_PROVIDER = 'resend'
const RESEND_API_BASE = 'https://api.resend.com'
const RESEND_DEFAULT_RESPONSE_BYTES = 16_000
const RESEND_MAX_RESPONSE_BYTES = 64 * 1024
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

const resendMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'DELETE'])
const resendQueryValueSchema = z.union([z.string(), z.number(), z.boolean()])

type ResendHttpMethod = z.infer<typeof resendMethodSchema>

interface ResendGroup {
  childToolId: string
  enabledField: ResendEnabledField
  endpointGuide: string
  id: string
  isInScope(pathname: string): boolean
  label: string
  scopeDescription: string
}

type ResendEnabledField =
  | 'enableEmails'
  | 'enableReceivingEmails'
  | 'enableDomains'
  | 'enableTemplates'
  | 'enableAudiences'
  | 'enableContacts'
  | 'enableBroadcasts'
  | 'enableSegments'
  | 'enableTopics'
  | 'enableContactProperties'
  | 'enableLogs'
  | 'enableAutomations'
  | 'enableEvents'

const RESEND_GROUPS: readonly ResendGroup[] = [
  {
    id: 'emails',
    childToolId: 'resend_emails',
    enabledField: 'enableEmails',
    label: 'Sending',
    scopeDescription: 'Paths under /emails (excluding /emails/receiving).',
    endpointGuide:
      'POST /emails (send), POST /emails/batch (batch send), GET /emails (list sent), GET /emails/{email_id}, PATCH /emails/{email_id}, POST /emails/{email_id}/cancel, GET /emails/{email_id}/attachments, GET /emails/{email_id}/attachments/{attachment_id}.',
    isInScope(pathname) {
      if (pathname === '/emails' || pathname === '/emails/batch') {
        return true
      }
      return (
        pathname.startsWith('/emails/') &&
        !pathname.startsWith('/emails/receiving')
      )
    },
  },
  {
    id: 'receiving_emails',
    childToolId: 'resend_receiving_emails',
    enabledField: 'enableReceivingEmails',
    label: 'Receiving Emails',
    scopeDescription: 'Paths under /emails/receiving.',
    endpointGuide:
      'GET /emails/receiving, GET /emails/receiving/{email_id}, GET /emails/receiving/{email_id}/attachments, GET /emails/receiving/{email_id}/attachments/{attachment_id}.',
    isInScope(pathname) {
      return (
        pathname === '/emails/receiving' ||
        pathname.startsWith('/emails/receiving/')
      )
    },
  },
  {
    id: 'domains',
    childToolId: 'resend_domains',
    enabledField: 'enableDomains',
    label: 'Domains',
    scopeDescription: 'Paths under /domains.',
    endpointGuide:
      'POST /domains, GET /domains, GET /domains/{domain_id}, PATCH /domains/{domain_id}, DELETE /domains/{domain_id}, POST /domains/{domain_id}/verify.',
    isInScope(pathname) {
      return pathname === '/domains' || pathname.startsWith('/domains/')
    },
  },
  {
    id: 'templates',
    childToolId: 'resend_templates',
    enabledField: 'enableTemplates',
    label: 'Templates',
    scopeDescription: 'Paths under /templates.',
    endpointGuide:
      'POST /templates, GET /templates, GET /templates/{id}, PATCH /templates/{id}, DELETE /templates/{id}, POST /templates/{id}/publish, POST /templates/{id}/duplicate.',
    isInScope(pathname) {
      return pathname === '/templates' || pathname.startsWith('/templates/')
    },
  },
  {
    id: 'audiences',
    childToolId: 'resend_audiences',
    enabledField: 'enableAudiences',
    label: 'Audiences',
    scopeDescription: 'Paths under /audiences.',
    endpointGuide:
      'POST /audiences, GET /audiences, GET /audiences/{id}, DELETE /audiences/{id}. Note: Resend marks Audiences as deprecated in favor of Segments.',
    isInScope(pathname) {
      return pathname === '/audiences' || pathname.startsWith('/audiences/')
    },
  },
  {
    id: 'contacts',
    childToolId: 'resend_contacts',
    enabledField: 'enableContacts',
    label: 'Contacts',
    scopeDescription:
      'Paths under /contacts, including /contacts/{contact_id}/segments and /contacts/{contact_id}/topics.',
    endpointGuide:
      'POST /contacts, GET /contacts, GET /contacts/{id}, PATCH /contacts/{id}, DELETE /contacts/{id}, GET /contacts/{contact_id}/segments, POST /contacts/{contact_id}/segments/{segment_id}, DELETE /contacts/{contact_id}/segments/{segment_id}, GET /contacts/{contact_id}/topics, PATCH /contacts/{contact_id}/topics.',
    isInScope(pathname) {
      return pathname === '/contacts' || pathname.startsWith('/contacts/')
    },
  },
  {
    id: 'broadcasts',
    childToolId: 'resend_broadcasts',
    enabledField: 'enableBroadcasts',
    label: 'Broadcasts',
    scopeDescription: 'Paths under /broadcasts.',
    endpointGuide:
      'POST /broadcasts, GET /broadcasts, GET /broadcasts/{id}, PATCH /broadcasts/{id}, DELETE /broadcasts/{id}, POST /broadcasts/{id}/send.',
    isInScope(pathname) {
      return pathname === '/broadcasts' || pathname.startsWith('/broadcasts/')
    },
  },
  {
    id: 'segments',
    childToolId: 'resend_segments',
    enabledField: 'enableSegments',
    label: 'Segments',
    scopeDescription: 'Paths under /segments.',
    endpointGuide:
      'POST /segments, GET /segments, GET /segments/{id}, DELETE /segments/{id}.',
    isInScope(pathname) {
      return pathname === '/segments' || pathname.startsWith('/segments/')
    },
  },
  {
    id: 'topics',
    childToolId: 'resend_topics',
    enabledField: 'enableTopics',
    label: 'Topics',
    scopeDescription: 'Paths under /topics.',
    endpointGuide:
      'POST /topics, GET /topics, GET /topics/{id}, PATCH /topics/{id}, DELETE /topics/{id}.',
    isInScope(pathname) {
      return pathname === '/topics' || pathname.startsWith('/topics/')
    },
  },
  {
    id: 'contact_properties',
    childToolId: 'resend_contact_properties',
    enabledField: 'enableContactProperties',
    label: 'Contact Properties',
    scopeDescription: 'Paths under /contact-properties.',
    endpointGuide:
      'POST /contact-properties, GET /contact-properties, GET /contact-properties/{id}, PATCH /contact-properties/{id}, DELETE /contact-properties/{id}.',
    isInScope(pathname) {
      return (
        pathname === '/contact-properties' ||
        pathname.startsWith('/contact-properties/')
      )
    },
  },
  {
    id: 'logs',
    childToolId: 'resend_logs',
    enabledField: 'enableLogs',
    label: 'Logs',
    scopeDescription: 'Paths under /logs.',
    endpointGuide: 'GET /logs, GET /logs/{log_id}.',
    isInScope(pathname) {
      return pathname === '/logs' || pathname.startsWith('/logs/')
    },
  },
  {
    id: 'automations',
    childToolId: 'resend_automations',
    enabledField: 'enableAutomations',
    label: 'Automations',
    scopeDescription: 'Paths under /automations.',
    endpointGuide:
      'POST /automations, GET /automations, GET /automations/{automation_id}, PATCH /automations/{automation_id}, DELETE /automations/{automation_id}, POST /automations/{automation_id}/stop, GET /automations/{automation_id}/runs, GET /automations/{automation_id}/runs/{run_id}.',
    isInScope(pathname) {
      return pathname === '/automations' || pathname.startsWith('/automations/')
    },
  },
  {
    id: 'events',
    childToolId: 'resend_events',
    enabledField: 'enableEvents',
    label: 'Events',
    scopeDescription: 'Paths under /events.',
    endpointGuide:
      'POST /events, GET /events, POST /events/send, GET /events/{identifier}, PATCH /events/{identifier}, DELETE /events/{identifier}.',
    isInScope(pathname) {
      return pathname === '/events' || pathname.startsWith('/events/')
    },
  },
] as const

type ResendBundleConfig = {
  readOnly: boolean
} & Record<ResendEnabledField, boolean>

const resendConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(true)
    .describe(
      'When true, only GET requests are allowed across every enabled group. Set false to allow create, update, delete, send, and other mutating calls.'
    ),
  enableEmails: z
    .boolean()
    .default(true)
    .describe(
      'Enable the Sending (Emails) child tool: POST /emails, POST /emails/batch, GET/PATCH /emails/{id}, POST /emails/{id}/cancel, and email attachments.'
    ),
  enableReceivingEmails: z
    .boolean()
    .default(true)
    .describe(
      'Enable the Receiving Emails child tool: GET /emails/receiving and received-email attachments.'
    ),
  enableDomains: z
    .boolean()
    .default(true)
    .describe('Enable the Domains child tool.'),
  enableTemplates: z
    .boolean()
    .default(true)
    .describe('Enable the Templates child tool.'),
  enableAudiences: z
    .boolean()
    .default(true)
    .describe(
      'Enable the Audiences child tool. Resend marks Audiences as deprecated in favor of Segments.'
    ),
  enableContacts: z
    .boolean()
    .default(true)
    .describe(
      'Enable the Contacts child tool, including contact-to-segment and contact-to-topic linking endpoints.'
    ),
  enableBroadcasts: z
    .boolean()
    .default(true)
    .describe('Enable the Broadcasts child tool.'),
  enableSegments: z
    .boolean()
    .default(true)
    .describe('Enable the Segments child tool.'),
  enableTopics: z
    .boolean()
    .default(true)
    .describe('Enable the Topics child tool.'),
  enableContactProperties: z
    .boolean()
    .default(true)
    .describe('Enable the Contact Properties child tool.'),
  enableLogs: z.boolean().default(true).describe('Enable the Logs child tool.'),
  enableAutomations: z
    .boolean()
    .default(true)
    .describe('Enable the Automations child tool.'),
  enableEvents: z
    .boolean()
    .default(true)
    .describe('Enable the Events child tool.'),
}) as unknown as z.ZodType<ResendBundleConfig>

function buildInputSchema(group: ResendGroup) {
  return z.object({
    method: resendMethodSchema
      .default('GET')
      .describe(
        'HTTP method. Non-GET methods require confirmMutation=true and the attachment must not be readOnly.'
      ),
    path: z
      .string()
      .min(1)
      .describe(
        `Relative Resend API path scoped to the ${group.label} group. Must start with "/". ${group.scopeDescription} Endpoints: ${group.endpointGuide}`
      ),
    query: z
      .record(resendQueryValueSchema)
      .optional()
      .describe('Optional query string parameters.'),
    body: z
      .union([z.record(z.unknown()), z.array(z.unknown())])
      .optional()
      .describe(
        'Optional JSON body for non-GET requests. Required by send/create/update endpoints. Use an array for endpoints that expect a JSON array payload (for example POST /emails/batch).'
      ),
    maxResponseBytes: z
      .number()
      .int()
      .min(1000)
      .max(RESEND_MAX_RESPONSE_BYTES)
      .default(RESEND_DEFAULT_RESPONSE_BYTES)
      .describe(
        `Maximum response bytes to return, from 1000 to ${RESEND_MAX_RESPONSE_BYTES}.`
      ),
    confirmMutation: z
      .boolean()
      .default(false)
      .describe(
        'Set true only when intentionally sending, creating, updating, deleting, or otherwise mutating Resend state.'
      ),
  })
}

type ResendRequestInput = z.infer<ReturnType<typeof buildInputSchema>>

function normalizePath(path: string): string {
  const trimmed = path.trim()
  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error('Path must be a single line.')
  }
  if (ABSOLUTE_URL_PATTERN.test(trimmed) || trimmed.startsWith('//')) {
    throw new Error('Path must be relative to api.resend.com.')
  }
  if (!trimmed.startsWith('/')) {
    throw new Error('Path must start with "/".')
  }
  return new URL(trimmed, RESEND_API_BASE).pathname
}

function appendQueryParams(
  url: URL,
  query: Record<string, string | number | boolean> | undefined
): void {
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.append(key, String(value))
  }
}

function isMutationMethod(method: ResendHttpMethod): boolean {
  return method !== 'GET'
}

async function executeResendRequest(args: {
  config: ResendBundleConfig
  ctx: ToolRuntimeContext
  group: ResendGroup
  input: ResendRequestInput
}) {
  const { config, ctx, group, input } = args

  if (input.method === 'GET' && input.body !== undefined) {
    return toolErrorFromProviderResponse(
      { bodyText: '', status: 400, truncated: false },
      {
        label: `Resend ${group.label} request`,
        errorCode: 'invalid_input',
      }
    )
  }

  let pathname: string
  try {
    pathname = normalizePath(input.path)
  } catch (error) {
    return toolErrorFromProviderResponse(
      {
        bodyText: error instanceof Error ? error.message : 'Invalid path.',
        status: 400,
        truncated: false,
      },
      { label: `Resend ${group.label} request`, errorCode: 'invalid_input' }
    )
  }

  if (!group.isInScope(pathname)) {
    return toolErrorFromProviderResponse(
      {
        bodyText: `Path "${pathname}" is outside the ${group.label} scope. ${group.scopeDescription}`,
        status: 400,
        truncated: false,
      },
      { label: `Resend ${group.label} request`, errorCode: 'invalid_input' }
    )
  }

  if (config.readOnly && isMutationMethod(input.method)) {
    return toolErrorFromProviderResponse(
      {
        bodyText:
          'This Resend attachment is configured as read-only. Only GET requests are allowed. Disable readOnly to perform mutations.',
        status: 403,
        truncated: false,
      },
      { label: `Resend ${group.label} request`, errorCode: 'policy_denied' }
    )
  }

  if (isMutationMethod(input.method) && !input.confirmMutation) {
    return toolErrorFromProviderResponse(
      {
        bodyText:
          'This Resend API call can mutate state and requires confirmMutation=true.',
        status: 403,
        truncated: false,
      },
      { label: `Resend ${group.label} request`, errorCode: 'policy_denied' }
    )
  }

  const url = new URL(pathname, RESEND_API_BASE)
  appendQueryParams(url, input.query)

  const headers: Record<string, string> = {}
  if (input.body !== undefined) {
    headers['content-type'] = 'application/json'
  }

  const response = await ctx.http.request(RESEND_PROVIDER, {
    method: input.method,
    url: url.toString(),
    headers,
    body: input.body,
    maxResponseBytes: input.maxResponseBytes,
  })

  if (!response.ok) {
    return toolErrorFromProviderResponse(response, {
      label: `Resend ${group.label} request`,
    })
  }

  return toolSuccess({
    status: response.status,
    normalizedPath: pathname,
    body: parseProviderResponseFromHttp(response),
    truncated: response.truncated,
  })
}

const resendBundleTools = Object.fromEntries(
  RESEND_GROUPS.map((group) => [
    group.childToolId,
    {
      displayName: `Resend · ${group.label}`,
      description: `Call Resend API endpoints in the ${group.label} group. ${group.endpointGuide} Mutating calls require confirmMutation=true and the attachment must not be readOnly.`,
      inputSchema: buildInputSchema(group),
      isEnabled(config: ResendBundleConfig) {
        return config[group.enabledField] ?? true
      },
      async execute({
        config,
        ctx,
        input,
      }: {
        config: ResendBundleConfig
        ctx: ToolRuntimeContext
        input: ResendRequestInput
      }) {
        return await executeResendRequest({ config, ctx, group, input })
      },
    },
  ])
)

export const resendApiTool = defineToolBundle({
  id: 'resend_api',
  category: 'email',
  displayName: 'Resend · API',
  description:
    'Authenticated Resend REST API surface, split into child tools per endpoint group (Sending, Receiving Emails, Domains, Templates, Audiences, Contacts, Broadcasts, Segments, Topics, Contact Properties, Logs, Automations, Events). Defaults to read-only. Excludes API Keys and Webhooks management.',
  capabilities: [{ kind: 'brokered_http', provider: RESEND_PROVIDER }],
  configSchema: resendConfigSchema,
  tools: resendBundleTools,
})
