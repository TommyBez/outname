import {
  type Corner,
  composabilityStages,
  type StageId,
} from '@outname/shared/marketing/data/composability-demo'
import {
  BrainIcon,
  GitBranchIcon,
  HammerIcon,
  RadioTowerIcon,
} from 'lucide-react'

export const stageIcons: Record<StageId, typeof HammerIcon> = {
  channels: RadioTowerIcon,
  memory: BrainIcon,
  subagents: GitBranchIcon,
  tools: HammerIcon,
}

export const cornerStart: Record<Corner, { left: number; top: number }> = {
  ne: { left: 86, top: 14 },
  nw: { left: 14, top: 14 },
  se: { left: 86, top: 86 },
  sw: { left: 14, top: 86 },
}

export const centerTarget = { left: 50, top: 50 }

export const cornerLabels: Record<Corner, string> = {
  ne: 'top-right',
  nw: 'top-left',
  se: 'bottom-right',
  sw: 'bottom-left',
}

export const stageCount = composabilityStages.length
export const totalParts = composabilityStages.reduce(
  (sum, stage) => sum + stage.parts.length,
  0
)

interface PartProgressMeta {
  partIndex: number
  stageEnd: number
  stageIndex: number
  stageStart: number
}

export const partProgressMeta = new Map<string, PartProgressMeta>()
composabilityStages.forEach((stage, stageIndex) => {
  const stageSlice = 1 / stageCount
  const stageStart = stageIndex * stageSlice
  stage.parts.forEach((part, partIndex) => {
    const partSlice = stageSlice / stage.parts.length
    const start = stageStart + partIndex * partSlice
    const end = start + partSlice
    partProgressMeta.set(part.id, {
      partIndex,
      stageEnd: end,
      stageIndex,
      stageStart: start,
    })
  })
})

export function stageSlotCounts(activeIndex: number) {
  return composabilityStages.map((stage, index) =>
    index <= activeIndex ? stage.parts.length : 0
  )
}

export function mostVisibleStageIndex(
  stageVisibility: ReadonlyMap<number, number>
) {
  let nextIndex = 0
  let bestRatio = 0

  for (const [index, ratio] of stageVisibility.entries()) {
    if (ratio > bestRatio) {
      bestRatio = ratio
      nextIndex = index
    }
  }

  return bestRatio > 0 ? nextIndex : null
}

export function mobileMarkerTone(isActive: boolean, isAttached: boolean) {
  if (isActive) {
    return 'bg-foreground text-background'
  }
  if (isAttached) {
    return 'bg-brand/35'
  }
  return 'bg-background'
}

export function mobileStageSurfaceTone(active: boolean, attached: boolean) {
  if (active) {
    return 'bg-brand/25'
  }
  if (attached) {
    return 'bg-muted'
  }
  return 'bg-background'
}

export function mobileStageStatus(active: boolean, attached: boolean) {
  if (active) {
    return 'Attaching now'
  }
  if (attached) {
    return 'Attached'
  }
  return 'Queued'
}
