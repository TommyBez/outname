import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { math } from '@streamdown/math'
import type { MermaidConfig } from '@streamdown/mermaid'
import type { DiagramPlugin } from 'streamdown'

type MermaidInstance = ReturnType<DiagramPlugin['getMermaid']>

/**
 * Drop-in replacement for `@streamdown/mermaid` that defers loading the
 * mermaid library (~2 MB minified) until a diagram actually renders, instead
 * of shipping it eagerly with every page that can display markdown.
 */
function createLazyMermaidPlugin(): DiagramPlugin {
  let config: MermaidConfig | undefined
  let realInstance: Promise<MermaidInstance> | null = null

  const loadInstance = () => {
    realInstance ??= import('@streamdown/mermaid').then((module) =>
      module.mermaid.getMermaid(config)
    )
    return realInstance
  }

  const instance: MermaidInstance = {
    initialize(next: MermaidConfig) {
      config = next
      realInstance = null
    },
    async render(id: string, source: string) {
      const real = await loadInstance()
      return await real.render(id, source)
    },
  }

  return {
    name: 'mermaid',
    type: 'diagram',
    language: 'mermaid',
    getMermaid(next?: MermaidConfig) {
      if (next) {
        instance.initialize(next)
      }
      return instance
    },
  }
}

/** Shared plugin set for every Streamdown surface (chat, reasoning, runs). */
export const streamdownPlugins = {
  cjk,
  code,
  math,
  mermaid: createLazyMermaidPlugin(),
}
