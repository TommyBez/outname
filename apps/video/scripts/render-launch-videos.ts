import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { launchVideoManifest } from '@outname/shared/content/outname-launch/assets/video-manifest'

type RenderMode = 'render' | 'still'

const ENTRYPOINT = 'remotion/index.ts'
const STILL_FRAME = '450'
const WORKSPACE_ROOT = resolve('../..')

function parseMode(value: string | undefined): RenderMode {
  if (value === 'still') {
    return 'still'
  }

  return 'render'
}

function getRemotionBin() {
  return process.platform === 'win32' ? 'remotion.cmd' : 'remotion'
}

function renderVariant(
  mode: RenderMode,
  variant: (typeof launchVideoManifest)[number]['variants'][number]
) {
  const outputPath = mode === 'still' ? variant.stillPath : variant.outputPath
  const absoluteOutputPath = resolve(WORKSPACE_ROOT, outputPath)
  mkdirSync(dirname(absoluteOutputPath), { recursive: true })

  const args =
    mode === 'still'
      ? [
          'still',
          ENTRYPOINT,
          variant.compositionId,
          absoluteOutputPath,
          `--frame=${STILL_FRAME}`,
          '--overwrite',
        ]
      : [
          'render',
          ENTRYPOINT,
          variant.compositionId,
          absoluteOutputPath,
          '--overwrite',
        ]

  console.log(`\nRendering ${variant.compositionId} -> ${outputPath}`)

  const result = spawnSync(getRemotionBin(), args, {
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(
      `Remotion ${mode} failed for ${variant.compositionId} with exit code ${result.status}`
    )
  }
}

function main() {
  const mode = parseMode(process.argv[2])

  for (const asset of launchVideoManifest) {
    for (const variant of asset.variants) {
      renderVariant(mode, variant)
    }
  }
}

main()
