import type { NetworkPolicy, NetworkPolicyRule } from '@vercel/sandbox'

export function createInjectedHeadersNetworkPolicy(input: {
  authenticatedHosts: readonly string[]
  injectedHeaders: Record<string, string>
  unauthenticatedHosts?: readonly string[]
}): NetworkPolicy {
  const allow: Record<string, NetworkPolicyRule[]> = {}

  for (const host of input.authenticatedHosts) {
    allow[host] = [{ transform: [{ headers: input.injectedHeaders }] }]
  }

  for (const host of input.unauthenticatedHosts ?? []) {
    allow[host] = []
  }

  return { allow }
}
