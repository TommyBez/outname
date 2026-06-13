import 'server-only'

import {
  createProductHuntLaunchState,
  type ProductHuntLaunchState,
} from '@outname/shared/launch/product-hunt'
import { resolveProductHuntLaunchUrl } from '@outname/shared/launch/product-hunt-url-discovery'

const PRODUCT_HUNT_PUBLIC_PAGE_DISCOVERY_TIMEOUT_MS = 1200

function getProductHuntUrlFromEnv(): {
  candidateUrls: string | null
  explicitUrl: string | null
  publicUrl: string | null
} {
  return {
    candidateUrls: process.env.PRODUCT_HUNT_LAUNCH_URL_CANDIDATES ?? null,
    explicitUrl: process.env.PRODUCT_HUNT_LAUNCH_URL ?? null,
    publicUrl: process.env.NEXT_PUBLIC_PRODUCT_HUNT_LAUNCH_URL ?? null,
  }
}

export function createStaticProductHuntLaunchState(): ProductHuntLaunchState {
  const urls = getProductHuntUrlFromEnv()

  return createProductHuntLaunchState({
    now: new Date(0),
    productHuntUrl: urls.publicUrl ?? urls.explicitUrl,
  })
}

export async function createDynamicProductHuntLaunchState(): Promise<ProductHuntLaunchState> {
  const urls = getProductHuntUrlFromEnv()
  const resolution = await resolveProductHuntLaunchUrl({
    candidateUrls: urls.candidateUrls,
    explicitUrl: urls.explicitUrl,
    publicUrl: urls.publicUrl,
    timeoutMs: PRODUCT_HUNT_PUBLIC_PAGE_DISCOVERY_TIMEOUT_MS,
  })

  return createProductHuntLaunchState({
    productHuntUrl: resolution.url,
  })
}
