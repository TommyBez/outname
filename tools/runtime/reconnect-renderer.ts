import type { Reconnect } from '@/tools/catalog/types'

export interface ReconnectView {
  body: string
  cta?: string
  title: string
}

function renderReconnect(r: Reconnect): ReconnectView {
  switch (r.reason) {
    case 'connection_unavailable':
      return {
        title: `${r.toolId}: connection unavailable`,
        body: `Connector "${r.connectorId}" is missing or unusable.`,
        cta: 'Connect or replace it from settings.',
      }
    case 'missing_scopes':
      return {
        title: `${r.toolId}: connection scopes missing`,
        body: `Connector "${r.connectorId}" is missing required scope${r.missing.length === 1 ? '' : 's'}: ${r.missing.join(', ')}.`,
        cta: 'Reconnect it from settings.',
      }
    case 'config_invalid':
      return {
        title: `${r.toolId}: invalid configuration`,
        body: r.message,
        cta: 'Re-attach this tool with valid configuration.',
      }
    case 'build_failed':
      return {
        title: `${r.toolId}: initialization failed`,
        body: r.message,
        cta: 'Route around this tool for now.',
      }
    case 'tool_removed':
      return {
        title: `${r.toolId}: removed`,
        body: 'This tool no longer exists in the registry.',
        cta: 'Detach it from the agent.',
      }
    case 'tool_sandbox_building':
      return {
        title: `${r.toolId}: environment building`,
        body: `Tool environment "${r.manifest}" is still being prepared.`,
        cta: 'Retry in a moment.',
      }
    case 'tool_sandbox_unavailable':
      return {
        title: `${r.toolId}: environment unavailable`,
        body: `Tool environment "${r.manifest}" is unavailable: ${r.message}`,
        cta: 'Re-attach this tool from settings.',
      }
    case 'sub_agent_unavailable':
      return {
        title: `${r.toolId}: sub-agent unavailable`,
        body: r.message,
      }
    case 'sub_agent_cycle':
      return {
        title: `${r.toolId}: sub-agent cycle`,
        body: 'This delegation would create a sub-agent cycle.',
      }
    case 'sub_agent_depth':
      return {
        title: `${r.toolId}: sub-agent depth limit`,
        body: 'This delegation exceeds the sub-agent nesting limit.',
      }
    default: {
      const _exhaustive: never = r
      return {
        title: 'Unknown reconnect reason',
        body: JSON.stringify(_exhaustive),
      }
    }
  }
}

export function reconnectPromptLine(r: Reconnect): string {
  const view = renderReconnect(r)
  const cta = view.cta ? ` ${view.cta}` : ''
  return `- \`${r.toolId}\` — ${view.body}${cta}`
}
