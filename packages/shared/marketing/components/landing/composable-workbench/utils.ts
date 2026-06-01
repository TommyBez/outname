import { partProgressMeta } from './constants'

export function clamp01(value: number) {
  if (value < 0) {
    return 0
  }
  if (value > 1) {
    return 1
  }
  return value
}

export function partSnapProgress(partId: string, sectionProgress: number) {
  const meta = partProgressMeta.get(partId)
  if (!meta) {
    return 0
  }
  return clamp01(
    (sectionProgress - meta.stageStart) / (meta.stageEnd - meta.stageStart)
  )
}
