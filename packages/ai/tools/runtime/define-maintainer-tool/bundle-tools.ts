import type { MaintainerExposedTool } from '@outname/ai/tools/catalog/types'
import type { BundleChildToolArgs } from './types'

export function resolveBundleChildren<TConfig>(
  tools: Record<string, BundleChildToolArgs<TConfig>>,
  config?: TConfig
): [string, BundleChildToolArgs<TConfig>][] {
  return Object.entries(tools).filter(([, child]) =>
    config === undefined ? true : (child.isEnabled?.(config) ?? true)
  )
}

export function toBundleExposedTools<TConfig>(
  tools: Record<string, BundleChildToolArgs<TConfig>>,
  config?: TConfig
): MaintainerExposedTool[] {
  return resolveBundleChildren(tools, config).map(([toolId, child]) => ({
    toolId,
    displayName: child.displayName,
    description: child.description,
    displayDescription: child.displayDescription,
  }))
}
