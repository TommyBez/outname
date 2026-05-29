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
