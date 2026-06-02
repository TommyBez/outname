import { launchVideoManifest } from '@outname/shared/content/outname-launch/assets/video-manifest'
import { Composition } from 'remotion'
import { LaunchVideo } from './launch-videos'

const FPS = 30

export function RemotionRoot() {
  return (
    <>
      {launchVideoManifest.flatMap((asset) =>
        asset.variants.map((variant) => (
          <Composition
            component={LaunchVideo}
            defaultProps={{
              aspect: variant.aspect,
              slug: asset.slug,
            }}
            durationInFrames={asset.durationInFrames}
            fps={FPS}
            height={variant.height}
            id={variant.compositionId}
            key={variant.compositionId}
            width={variant.width}
          />
        ))
      )}
    </>
  )
}
