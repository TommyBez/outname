import 'server-only'

import { Sandbox } from '@vercel/sandbox'
import type { getConnector } from '@/connections/registry'
import { brokeredHttpSandboxTags } from '@/shared/server/vercel-sandbox-config'
import { readProviderCredential } from '@/tools/runtime/define-maintainer-tool/credential-resolver'
import { createInjectedHeadersNetworkPolicy } from '@/tools/runtime/network-policy'
import { currentToolRuntimeRunId } from '@/tools/runtime/run-id'
import { validateInjectedHeaders } from './validation'

interface CachedBrokerSandbox {
  provider: string
  sandboxPromise: Promise<Sandbox>
}

const brokerSandboxCache = new Map<string, Map<string, CachedBrokerSandbox>>()

export function currentRunId(): string {
  return currentToolRuntimeRunId()
}

export async function getOrCreateBrokerSandbox(input: {
  createSandbox: () => Promise<Sandbox>
  provider: string
  runId: string
}): Promise<Sandbox> {
  let perRun = brokerSandboxCache.get(input.runId)
  if (perRun) {
    const cached = perRun.get(input.provider)
    if (cached) {
      return await cached.sandboxPromise
    }
  } else {
    perRun = new Map()
    brokerSandboxCache.set(input.runId, perRun)
  }

  const sandboxPromise = input.createSandbox().catch((err) => {
    perRun?.delete(input.provider)
    throw err
  })
  perRun.set(input.provider, {
    provider: input.provider,
    sandboxPromise,
  })
  return await sandboxPromise
}

export async function createBrokerSandbox(input: {
  connector: NonNullable<ReturnType<typeof getConnector>>
  provider: string
  runId: string
  toolConfig?: Record<string, unknown>
  unauthenticatedHosts?: readonly string[]
  userId: string
}): Promise<Sandbox> {
  const credential = await readProviderCredential({
    provider: input.provider,
    toolConfig: input.toolConfig,
    userId: input.userId,
  })
  const injectedHeaders = validateInjectedHeaders(
    input.provider,
    input.connector.broker.injectedHeaderNames,
    input.connector.broker.injectedHeaders(credential)
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
      provider: input.provider,
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
    Array.from(perRun.values()).map(async ({ provider, sandboxPromise }) => {
      try {
        const sandbox = await sandboxPromise
        await sandbox.stop()
      } catch (err) {
        console.error('stopAllBrokeredHttpSandboxesForRun: stop failed', {
          provider,
          err,
        })
      }
    })
  )
  brokerSandboxCache.delete(runId)
}
