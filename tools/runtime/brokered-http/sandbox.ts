import 'server-only'

import { Sandbox } from '@vercel/sandbox'
import type { getConnector } from '@/connections/registry'
import type { RawCredential } from '@/connections/types'
import { brokeredHttpSandboxTags } from '@/shared/server/vercel-sandbox-config'
import { readConnectorCredential } from '@/tools/runtime/define-maintainer-tool/credential-resolver'
import { createInjectedHeadersNetworkPolicy } from '@/tools/runtime/network-policy'
import { currentToolRuntimeRunId } from '@/tools/runtime/run-id'
import { validateInjectedHeaders } from './validation'

interface CachedBrokerSandbox {
  connectorId: string
  sandboxPromise: Promise<Sandbox>
}

const brokerSandboxCache = new Map<string, Map<string, CachedBrokerSandbox>>()

export function currentRunId(): string {
  return currentToolRuntimeRunId()
}

export async function getOrCreateBrokerSandbox(input: {
  createSandbox: () => Promise<Sandbox>
  connectorId: string
  runId: string
}): Promise<Sandbox> {
  let perRun = brokerSandboxCache.get(input.runId)
  if (perRun) {
    const cached = perRun.get(input.connectorId)
    if (cached) {
      return await cached.sandboxPromise
    }
  } else {
    perRun = new Map()
    brokerSandboxCache.set(input.runId, perRun)
  }

  const sandboxPromise = input.createSandbox().catch((err) => {
    perRun?.delete(input.connectorId)
    throw err
  })
  perRun.set(input.connectorId, {
    connectorId: input.connectorId,
    sandboxPromise,
  })
  return await sandboxPromise
}

export async function createBrokerSandbox(input: {
  connector: NonNullable<ReturnType<typeof getConnector>>
  connectorId: string
  credential?: RawCredential
  runId: string
  toolConfig?: Record<string, unknown>
  unauthenticatedHosts?: readonly string[]
  userId: string
}): Promise<Sandbox> {
  const credential =
    input.credential ??
    (await readConnectorCredential({
      connectorId: input.connectorId,
      toolConfig: input.toolConfig,
      userId: input.userId,
    }))
  const injectedHeaders = validateInjectedHeaders(
    input.connectorId,
    input.connector.broker.injectedHeaderNames,
    input.connector.broker.injectedHeaders(credential as never)
  )
  const networkPolicy = createInjectedHeadersNetworkPolicy({
    authenticatedHosts: input.connector.broker.allowedHosts,
    injectedHeaders,
    unauthenticatedHosts: input.unauthenticatedHosts,
  })
  return await Sandbox.create({
    runtime: 'node24',
    timeout: 600_000,
    networkPolicy,
    persistent: false,
    resources: { vcpus: 1 },
    tags: brokeredHttpSandboxTags({
      connectorId: input.connectorId,
      runId: input.runId,
    }),
  })
}

export async function stopAllBrokeredHttpSandboxesForRun(): Promise<void> {
  let runId: string
  try {
    runId = currentRunId()
  } catch {
    return
  }

  const perRun = brokerSandboxCache.get(runId)
  if (!perRun || perRun.size === 0) {
    brokerSandboxCache.delete(runId)
    return
  }

  await Promise.all(
    Array.from(perRun.values()).map(async ({ connectorId, sandboxPromise }) => {
      try {
        const sandbox = await sandboxPromise
        await sandbox.stop()
      } catch (err) {
        console.error('stopAllBrokeredHttpSandboxesForRun: stop failed', {
          connectorId,
          err,
        })
      }
    })
  )
  brokerSandboxCache.delete(runId)
}
