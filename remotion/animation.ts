import { Easing, interpolate } from 'remotion'

export function appear(
  frame: number,
  startFrame: number,
  durationInFrames: number
) {
  return interpolate(
    frame,
    [startFrame, startFrame + durationInFrames],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  )
}

export function progressBetween(
  frame: number,
  startFrame: number,
  endFrame: number
) {
  return interpolate(frame, [startFrame, endFrame], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

export function translateIn(
  frame: number,
  startFrame: number,
  distance: number
) {
  const progress = appear(frame, startFrame, 18)
  return {
    opacity: progress,
    transform: `translateY(${(1 - progress) * distance}px)`,
  }
}
