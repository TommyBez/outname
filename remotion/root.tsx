import { Composition } from 'remotion'
import { scheduledRunVideo } from '@/content/outname-launch/assets/video-manifest'
import { ScheduledRunDemo } from './scheduled-run-demo'

const FPS = 30
const DURATION_IN_FRAMES = 720

export function RemotionRoot() {
  return (
    <>
      {scheduledRunVideo.variants.map((variant) => (
        <Composition
          component={ScheduledRunDemo}
          defaultProps={{ aspect: variant.aspect }}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          height={variant.height}
          id={variant.compositionId}
          key={variant.compositionId}
          width={variant.width}
        />
      ))}
    </>
  )
}
