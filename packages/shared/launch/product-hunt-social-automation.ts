import 'server-only'

import { setTimeout as sleep } from 'node:timers/promises'
import { db } from '@outname/db'
import { launchSocialPostDelivery, userConnections } from '@outname/db/schema'
import { readConnectorCredential } from '@outname/shared/connections/runtime/credential'
import { PRODUCT_HUNT_LAUNCH } from '@outname/shared/launch/product-hunt'
import { areProductHuntLaunchExternalSideEffectsDisabled } from '@outname/shared/launch/product-hunt-preview-safety'
import {
  getProductHuntSocialSkipReason as getSocialSkipReason,
  PRODUCT_HUNT_SOCIAL_POSTS,
  type ProductHuntSocialPlatform,
  type ProductHuntSocialPost,
  renderProductHuntSocialText,
} from '@outname/shared/launch/product-hunt-social'
import { siteConfig } from '@outname/shared/server/site-metadata'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

const TYPEFULLY_API_BASE = 'https://api.typefully.com'
const TYPEFULLY_CONNECTOR_ID = 'typefully.api_key'
const MEDIA_READY_ATTEMPTS = 8
const MEDIA_READY_DELAY_MS = 1500

interface TypefullyCredential {
  apiKey: string
}

interface TypefullySocialSet {
  id: number
  name?: string | null
}

interface TypefullyDraftListItem {
  draft_title?: string | null
  id: number
  scheduled_date?: string | null
  status?: string | null
}

interface TypefullyDraftListResponse {
  results?: TypefullyDraftListItem[]
}

interface TypefullyDraftResponse {
  draft_title?: string | null
  id: number
  scheduled_date?: string | null
  status?: string | null
}

interface TypefullyMediaUploadResponse {
  media_id: string
  upload_url: string
}

interface TypefullyMediaStatusResponse {
  error_reason?: string | null
  media_id: string
  status: 'failed' | 'processing' | 'ready'
}

export interface ProductHuntSocialAutomationResult {
  ok: true
  posts: {
    error?: string
    postId: string
    reason?: string
    skipped: boolean
    typefullyDraftId?: string
  }[]
}

function createSocialDeliveryId(): string {
  return `lspd_${nanoid(12)}`
}

function createSkippedSocialAutomationResult(input: {
  error?: string
  reason: string
}): ProductHuntSocialAutomationResult {
  return {
    ok: true,
    posts: PRODUCT_HUNT_SOCIAL_POSTS.map((post) => ({
      ...(input.error ? { error: input.error } : {}),
      postId: post.id,
      reason: input.reason,
      skipped: true,
    })),
  }
}

function getTypefullyApiKey(credential: unknown): string {
  if (
    typeof credential === 'object' &&
    credential !== null &&
    'apiKey' in credential &&
    typeof credential.apiKey === 'string' &&
    credential.apiKey.length > 0
  ) {
    return credential.apiKey
  }
  throw new Error('Stored Typefully credential is missing apiKey.')
}

function shouldAttachSocialMedia(): boolean {
  return process.env.PRODUCT_HUNT_SOCIAL_ATTACH_MEDIA !== 'false'
}

function createDraftTitle(post: ProductHuntSocialPost): string {
  return `OUTNA.ME Product Hunt / ${post.id}`
}

function createAssetUrl(post: ProductHuntSocialPost): string {
  return new URL(post.assetPath, siteConfig.url).toString()
}

function createDeliveryScheduledAt(input: {
  draft: TypefullyDraftResponse | TypefullyDraftListItem
  fallback: Date
}): Date {
  if (input.draft.scheduled_date) {
    return new Date(input.draft.scheduled_date)
  }
  return input.fallback
}

function createPublishAtValue(post: ProductHuntSocialPost, now: Date): string {
  const publishAt = new Date(post.publishAtIso)
  if (publishAt.getTime() <= now.getTime()) {
    return 'now'
  }
  return post.publishAtIso
}

async function findTypefullyConnection(userId: string) {
  const filters = [
    eq(userConnections.connectorId, TYPEFULLY_CONNECTOR_ID),
    eq(userConnections.status, 'active'),
    eq(userConnections.userId, userId),
  ]

  const [row] = await db
    .select({ userId: userConnections.userId })
    .from(userConnections)
    .where(and(...filters))
    .limit(1)

  return row ?? null
}

async function typefullyJson<T>(input: {
  apiKey: string
  body?: unknown
  method?: 'GET' | 'POST'
  path: string
  query?: Record<string, string>
}): Promise<T> {
  const url = new URL(input.path, TYPEFULLY_API_BASE)
  for (const [key, value] of Object.entries(input.query ?? {})) {
    url.searchParams.set(key, value)
  }
  const response = await fetch(url, {
    body: input.body ? JSON.stringify(input.body) : undefined,
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      ...(input.body ? { 'content-type': 'application/json' } : {}),
    },
    method: input.method ?? 'GET',
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Typefully ${input.method ?? 'GET'} ${url.pathname} failed with ${response.status}: ${body.slice(0, 400)}`
    )
  }

  return (await response.json()) as T
}

async function resolveTypefullySocialSet(input: {
  apiKey: string
  configuredSocialSetId?: string | null
}): Promise<string | null> {
  const trimmed = input.configuredSocialSetId?.trim()
  if (trimmed) {
    return trimmed
  }

  const response = await typefullyJson<{ results?: TypefullySocialSet[] }>({
    apiKey: input.apiKey,
    path: '/v2/social-sets',
    query: { limit: '2' },
  })

  const socialSets = response.results ?? []
  if (socialSets.length === 1) {
    const [socialSet] = socialSets
    return String(socialSet.id)
  }
  if (socialSets.length > 1) {
    throw new Error(
      'Multiple Typefully social sets are available. Configure PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID before running launch social automation.'
    )
  }
  return null
}

function getConfiguredTypefullyApiKey(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function resolveTypefullyApiKey(input: {
  apiKey?: string | null
  typefullyUserId?: string | null
}): Promise<{ apiKey: string } | { reason: string }> {
  const configuredApiKey = getConfiguredTypefullyApiKey(input.apiKey)
  if (configuredApiKey) {
    return { apiKey: configuredApiKey }
  }

  const userId = input.typefullyUserId?.trim()
  if (!userId) {
    return { reason: 'typefully_configuration_missing' }
  }

  const connection = await findTypefullyConnection(userId)
  if (!connection) {
    return { reason: 'typefully_connection_missing' }
  }

  const credentialResult = await readConnectorCredential({
    connectorId: TYPEFULLY_CONNECTOR_ID,
    userId: connection.userId,
  })
  const credential = credentialResult.credential as TypefullyCredential
  return { apiKey: getTypefullyApiKey(credential) }
}

async function findExistingDraft(input: {
  apiKey: string
  draftTitle: string
  socialSetId: string
}): Promise<TypefullyDraftListItem | null> {
  const response = await typefullyJson<TypefullyDraftListResponse>({
    apiKey: input.apiKey,
    path: `/v2/social-sets/${input.socialSetId}/drafts`,
    query: { limit: '50', order_by: '-created_at' },
  })

  return (
    response.results?.find((draft) => draft.draft_title === input.draftTitle) ??
    null
  )
}

async function uploadPostMedia(input: {
  apiKey: string
  post: ProductHuntSocialPost
  socialSetId: string
}): Promise<string[]> {
  if (!shouldAttachSocialMedia()) {
    return []
  }

  const assetUrl = createAssetUrl(input.post)
  const assetResponse = await fetch(assetUrl)
  if (!assetResponse.ok) {
    throw new Error(
      `Could not fetch social asset ${assetUrl}: ${assetResponse.status}`
    )
  }

  const fileName = input.post.assetPath.split('/').at(-1)
  if (!fileName) {
    throw new Error(`Invalid social asset path: ${input.post.assetPath}`)
  }

  const upload = await typefullyJson<TypefullyMediaUploadResponse>({
    apiKey: input.apiKey,
    body: { file_name: fileName },
    method: 'POST',
    path: `/v2/social-sets/${input.socialSetId}/media/upload`,
  })

  const putResponse = await fetch(upload.upload_url, {
    body: await assetResponse.arrayBuffer(),
    method: 'PUT',
  })
  if (!putResponse.ok) {
    throw new Error(`Typefully media upload failed with ${putResponse.status}.`)
  }

  for (let attempt = 0; attempt < MEDIA_READY_ATTEMPTS; attempt += 1) {
    const status = await typefullyJson<TypefullyMediaStatusResponse>({
      apiKey: input.apiKey,
      path: `/v2/social-sets/${input.socialSetId}/media/${upload.media_id}`,
    })
    if (status.status === 'ready') {
      return [upload.media_id]
    }
    if (status.status === 'failed') {
      throw new Error(
        `Typefully media processing failed: ${status.error_reason ?? 'unknown error'}`
      )
    }
    await sleep(MEDIA_READY_DELAY_MS)
  }

  throw new Error(`Typefully media ${upload.media_id} was not ready in time.`)
}

function createPlatformsPayload(input: {
  mediaIds: string[]
  platform: ProductHuntSocialPlatform
  text: string
}) {
  const post = {
    text: input.text,
    ...(input.mediaIds.length > 0 ? { media_ids: input.mediaIds } : {}),
  }

  if (input.platform === 'x') {
    return { x: { enabled: true, posts: [post] } }
  }

  return { linkedin: { enabled: true, posts: [post] } }
}

async function createTypefullyDraft(input: {
  apiKey: string
  draftTitle: string
  now: Date
  post: ProductHuntSocialPost
  productHuntUrl: string | null
  socialSetId: string
}): Promise<TypefullyDraftResponse> {
  const mediaIds = await uploadPostMedia({
    apiKey: input.apiKey,
    post: input.post,
    socialSetId: input.socialSetId,
  })
  const text = renderProductHuntSocialText({
    post: input.post,
    productHuntUrl: input.productHuntUrl,
  })

  return await typefullyJson<TypefullyDraftResponse>({
    apiKey: input.apiKey,
    body: {
      draft_title: input.draftTitle,
      platforms: createPlatformsPayload({
        mediaIds,
        platform: input.post.platform,
        text,
      }),
      publish_at: createPublishAtValue(input.post, input.now),
      share: false,
    },
    method: 'POST',
    path: `/v2/social-sets/${input.socialSetId}/drafts`,
  })
}

async function hasRecordedSocialDelivery(postId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: launchSocialPostDelivery.id })
    .from(launchSocialPostDelivery)
    .where(
      and(
        eq(launchSocialPostDelivery.launchKey, PRODUCT_HUNT_LAUNCH.campaign),
        eq(launchSocialPostDelivery.postId, postId)
      )
    )
    .limit(1)
  return Boolean(row)
}

async function recordSocialDelivery(input: {
  draft: TypefullyDraftResponse | TypefullyDraftListItem
  post: ProductHuntSocialPost
  scheduledAt: Date
  socialSetId: string
}) {
  await db
    .insert(launchSocialPostDelivery)
    .values({
      id: createSocialDeliveryId(),
      connectorId: TYPEFULLY_CONNECTOR_ID,
      launchKey: PRODUCT_HUNT_LAUNCH.campaign,
      platform: input.post.platform,
      postId: input.post.id,
      scheduledAt: input.scheduledAt,
      socialSetId: input.socialSetId,
      typefullyDraftId: String(input.draft.id),
    })
    .onConflictDoNothing()
}

async function runSocialPost(input: {
  apiKey: string
  now: Date
  post: ProductHuntSocialPost
  productHuntUrl: string | null
  socialSetId: string
}) {
  if (await hasRecordedSocialDelivery(input.post.id)) {
    return {
      postId: input.post.id,
      reason: 'already_recorded',
      skipped: true,
    }
  }

  const skipReason = getSocialSkipReason({
    now: input.now,
    post: input.post,
    productHuntUrl: input.productHuntUrl,
  })
  if (skipReason) {
    return {
      postId: input.post.id,
      reason: skipReason,
      skipped: true,
    }
  }

  const draftTitle = createDraftTitle(input.post)
  const existingDraft = await findExistingDraft({
    apiKey: input.apiKey,
    draftTitle,
    socialSetId: input.socialSetId,
  })
  if (existingDraft) {
    await recordSocialDelivery({
      draft: existingDraft,
      post: input.post,
      scheduledAt: createDeliveryScheduledAt({
        draft: existingDraft,
        fallback: input.now,
      }),
      socialSetId: input.socialSetId,
    })
    return {
      postId: input.post.id,
      reason: 'existing_typefully_draft',
      skipped: true,
      typefullyDraftId: String(existingDraft.id),
    }
  }

  const draft = await createTypefullyDraft({
    apiKey: input.apiKey,
    draftTitle,
    now: input.now,
    post: input.post,
    productHuntUrl: input.productHuntUrl,
    socialSetId: input.socialSetId,
  })
  await recordSocialDelivery({
    draft,
    post: input.post,
    scheduledAt: createDeliveryScheduledAt({
      draft,
      fallback: input.now,
    }),
    socialSetId: input.socialSetId,
  })

  return {
    postId: input.post.id,
    skipped: false,
    typefullyDraftId: String(draft.id),
  }
}

export async function runProductHuntSocialAutomation(input: {
  apiKey?: string | null
  now?: Date
  productHuntUrl: string | null
  socialSetId?: string | null
  typefullyUserId?: string | null
}): Promise<ProductHuntSocialAutomationResult> {
  if (areProductHuntLaunchExternalSideEffectsDisabled()) {
    return createSkippedSocialAutomationResult({
      reason: 'preview_external_side_effects_disabled',
    })
  }

  const now = input.now ?? new Date()
  const posts: ProductHuntSocialAutomationResult['posts'] = []

  let apiKey: string
  let socialSetId: string | null
  try {
    const apiKeyResolution = await resolveTypefullyApiKey({
      apiKey: input.apiKey,
      typefullyUserId: input.typefullyUserId,
    })
    if ('reason' in apiKeyResolution) {
      return createSkippedSocialAutomationResult({
        reason: apiKeyResolution.reason,
      })
    }

    apiKey = apiKeyResolution.apiKey
    socialSetId = await resolveTypefullySocialSet({
      apiKey,
      configuredSocialSetId: input.socialSetId,
    })
  } catch (error) {
    return createSkippedSocialAutomationResult({
      error: error instanceof Error ? error.message : 'Unknown error',
      reason: 'typefully_setup_failed',
    })
  }

  if (!socialSetId) {
    return createSkippedSocialAutomationResult({
      reason: 'typefully_social_set_missing',
    })
  }

  for (const post of PRODUCT_HUNT_SOCIAL_POSTS) {
    try {
      posts.push(
        await runSocialPost({
          apiKey,
          now,
          post,
          productHuntUrl: input.productHuntUrl,
          socialSetId,
        })
      )
    } catch (error) {
      posts.push({
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: post.id,
        reason: 'typefully_request_failed',
        skipped: true,
      })
    }
  }

  return { ok: true, posts }
}
