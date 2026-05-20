import 'server-only'

import { Buffer } from 'node:buffer'
import { getConnector } from '@/connections/registry'
import { readConnectorCredentialSnapshot } from '@/tools/runtime/define-maintainer-tool/credential-resolver'
import { DEFAULT_TIMEOUT_MS, FETCH_RUNNER, MAX_STDERR_BYTES } from './constants'
import {
  createBrokerSandbox,
  currentRunId,
  getOrCreateBrokerSandbox,
} from './sandbox'
import type {
  BrokeredHttpRequest as BrokeredHttpRequestType,
  BrokeredHttpResponse as BrokeredHttpResponseType,
} from './types'
import { BrokeredHttpError } from './types'
import {
  bodyTextFor,
  normalizeHeaders,
  responseLimit,
  validateUrl,
} from './validation'

export async function brokeredHttpRequest(input: {
  agentId: string
  attachmentToolId: string
  connectorId: string
  request: BrokeredHttpRequestType
  toolConfig?: Record<string, unknown>
  toolId: string
  userId: string
}): Promise<BrokeredHttpResponseType> {
  'use step'
  const connector = getConnector(input.connectorId)
  if (!connector) {
    throw new BrokeredHttpError(`Unknown connector: ${input.connectorId}`)
  }

  const method = input.request.method.toUpperCase()
  const { mode, url } = validateUrl(
    input.connectorId,
    method,
    input.request.url,
    connector
  )
  const headers = normalizeHeaders(
    input.request.headers,
    connector.broker.injectedHeaderNames
  )
  const runnerInput = {
    url: url.toString(),
    method,
    headers,
    bodyText: bodyTextFor(input.request.body),
    timeoutMs: input.request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxResponseBytes: responseLimit(
      connector.broker.maxResponseBytes,
      input.request.maxResponseBytes
    ),
  }
  const runId = currentRunId()
  const credentialSnapshot =
    mode === 'authenticated'
      ? await readConnectorCredentialSnapshot({
          connectorId: input.connectorId,
          toolConfig: input.toolConfig,
          userId: input.userId,
        })
      : null
  const sandboxConnectorId = credentialSnapshot
    ? `${input.connectorId}:${input.attachmentToolId}:${credentialSnapshot.credentialSource}:${credentialSnapshot.tokenFingerprint}`
    : `${input.connectorId}:unauthenticated:${url.hostname}`
  const sandbox = await getOrCreateBrokerSandbox({
    runId,
    connectorId: sandboxConnectorId,
    createSandbox: () =>
      createBrokerSandbox({
        connector,
        connectorId: input.connectorId,
        credential: credentialSnapshot?.credential,
        runId,
        toolConfig: input.toolConfig,
        unauthenticatedHosts: mode === 'authenticated' ? [] : [url.hostname],
        userId: input.userId,
      }),
  })
  const encoded = Buffer.from(JSON.stringify(runnerInput)).toString('base64url')
  const result = await sandbox.runCommand('node', [
    '--input-type=module',
    '-e',
    FETCH_RUNNER,
    encoded,
  ])
  const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()])
  if (result.exitCode !== 0) {
    throw new BrokeredHttpError(
      `${input.toolId}: brokered request failed (${stderr.slice(0, MAX_STDERR_BYTES)})`
    )
  }
  return JSON.parse(stdout) as BrokeredHttpResponseType
}
