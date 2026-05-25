import 'server-only'

import { and, desc, eq, gt, ilike, isNotNull, type SQL } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { auth } from '@/auth/server/auth'
import { db } from '@/shared/db'
import { user, waitlistEntry } from '@/shared/db/schema'
import {
  WAITLIST_CONFIRMATION_RESEND_COOLDOWN_MS,
  type WaitlistEntryStatus,
  type WaitlistPrimaryInterest,
  type WaitlistProfileType,
} from '@/waitlist/server/constants'
import { hashWaitlistToken, issueWaitlistToken } from '@/waitlist/server/token'

const ADMIN_INVITEABLE_STATUSES: WaitlistEntryStatus[] = [
  'confirmed',
  'invited',
]
const TERMINAL_PUBLIC_STATUSES: WaitlistEntryStatus[] = [
  'confirmed',
  'invited',
  'converted',
  'unsubscribed',
]
const ACCESS_PROVISIONABLE_STATUSES: WaitlistEntryStatus[] = [
  'confirmed',
  'invited',
  'converted',
]

export interface WaitlistMetadataInput {
  referrer?: string | null
  source?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmMedium?: string | null
  utmSource?: string | null
}

export interface WaitlistSubmissionInput extends WaitlistMetadataInput {
  email: string
  name?: string | null
  now?: Date
  primaryInterest?: WaitlistPrimaryInterest | null
  profileType?: WaitlistProfileType | null
  useCase?: string | null
}

export interface WaitlistFilters {
  createdWithinDays?: number
  primaryInterest?: WaitlistPrimaryInterest
  profileType?: WaitlistProfileType
  search?: string
  source?: string
  status?: WaitlistEntryStatus
}

export function normalizeWaitlistEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeOptionalText(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function buildProvisionedUserName(input: {
  email: string
  name?: string | null
}) {
  const normalizedName = normalizeOptionalText(input.name)
  if (normalizedName) {
    return normalizedName
  }

  const [localPart = 'outname user'] = input.email.split('@')
  const fallbackName = localPart
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

  return fallbackName || 'outname user'
}

export function isWaitlistResendCoolingDown(sentAt?: Date | null): boolean {
  if (!sentAt) {
    return false
  }
  return (
    Date.now() - sentAt.getTime() < WAITLIST_CONFIRMATION_RESEND_COOLDOWN_MS
  )
}

function createWaitlistEntryId(): string {
  return `wle_${nanoid(12)}`
}

function toMetadataPatch(input: WaitlistMetadataInput) {
  return {
    referrer: normalizeOptionalText(input.referrer),
    source: normalizeOptionalText(input.source),
    utmCampaign: normalizeOptionalText(input.utmCampaign),
    utmContent: normalizeOptionalText(input.utmContent),
    utmMedium: normalizeOptionalText(input.utmMedium),
    utmSource: normalizeOptionalText(input.utmSource),
  }
}

export async function getWaitlistEntryById(entryId: string) {
  const [entry] = await db
    .select()
    .from(waitlistEntry)
    .where(eq(waitlistEntry.id, entryId))
    .limit(1)
  return entry ?? null
}

export async function getWaitlistEntryByEmail(email: string) {
  const normalizedEmail = normalizeWaitlistEmail(email)
  const [entry] = await db
    .select()
    .from(waitlistEntry)
    .where(eq(waitlistEntry.email, normalizedEmail))
    .limit(1)
  return entry ?? null
}

async function getAuthUserByEmail(email: string) {
  const normalizedEmail = normalizeWaitlistEmail(email)
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1)

  return existingUser ?? null
}

async function markUserEmailVerified(userId: string, now: Date) {
  await db
    .update(user)
    .set({
      emailVerified: true,
      updatedAt: now,
    })
    .where(eq(user.id, userId))
}

async function markWaitlistProvisioned(
  entryId: string,
  provisionedUserId: string,
  now: Date
) {
  const [updatedEntry] = await db
    .update(waitlistEntry)
    .set({
      provisionedAt: now,
      provisionedUserId,
      updatedAt: now,
    })
    .where(eq(waitlistEntry.id, entryId))
    .returning()

  if (!updatedEntry) {
    throw new Error('Waitlist entry not found')
  }

  return updatedEntry
}

async function ensureProvisionedWaitlistUser(entryId: string) {
  const entry = await getWaitlistEntryById(entryId)
  if (
    !(
      entry &&
      ACCESS_PROVISIONABLE_STATUSES.includes(
        entry.status as WaitlistEntryStatus
      )
    )
  ) {
    throw new Error(
      'Only confirmed or invited waitlist entries can be provisioned'
    )
  }

  const now = new Date()
  const existingUser =
    (entry.provisionedUserId
      ? await db
          .select()
          .from(user)
          .where(eq(user.id, entry.provisionedUserId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null) ?? (await getAuthUserByEmail(entry.email))

  if (existingUser) {
    await Promise.all([
      markUserEmailVerified(existingUser.id, now),
      markWaitlistProvisioned(entry.id, existingUser.id, now),
    ])

    return {
      entryId: entry.id,
      userId: existingUser.id,
      wasCreated: false,
    }
  }

  const created = await auth.api.createUser({
    body: {
      email: entry.email,
      name: buildProvisionedUserName(entry),
    },
  })

  await Promise.all([
    markUserEmailVerified(created.user.id, now),
    markWaitlistProvisioned(entry.id, created.user.id, now),
  ])

  return {
    entryId: entry.id,
    userId: created.user.id,
    wasCreated: true,
  }
}

export function provisionWaitlistAccess(entryId: string) {
  return ensureProvisionedWaitlistUser(entryId)
}

export async function provisionWaitlistAccessByEmail(email: string) {
  const entry = await getWaitlistEntryByEmail(email)
  if (
    !(
      entry &&
      ACCESS_PROVISIONABLE_STATUSES.includes(
        entry.status as WaitlistEntryStatus
      )
    )
  ) {
    return null
  }

  return ensureProvisionedWaitlistUser(entry.id)
}

export interface WaitlistAdminSignupNotification {
  email: string
  entryId: string
  name: string | null
  primaryInterest: WaitlistPrimaryInterest | null
  profileType: WaitlistProfileType | null
  source: string | null
  useCase: string | null
  utmCampaign: string | null
  utmMedium: string | null
  utmSource: string | null
}

export async function submitWaitlistEntry(
  input: WaitlistSubmissionInput
): Promise<{
  adminNotification: WaitlistAdminSignupNotification | null
  emailToSend: { email: string; token: string } | null
  entryId: string
}> {
  const now = input.now ?? new Date()
  const normalizedEmail = normalizeWaitlistEmail(input.email)
  const name = normalizeOptionalText(input.name)
  const primaryInterest = input.primaryInterest ?? null
  const profileType = input.profileType ?? null
  const useCase = normalizeOptionalText(input.useCase)
  const metadataPatch = toMetadataPatch(input)
  const existing = await getWaitlistEntryByEmail(normalizedEmail)

  if (!existing) {
    const token = issueWaitlistToken(now)
    const [created] = await db
      .insert(waitlistEntry)
      .values({
        id: createWaitlistEntryId(),
        email: normalizedEmail,
        name,
        primaryInterest,
        profileType,
        useCase,
        status: 'pending',
        confirmationTokenHash: token.hash,
        confirmationTokenExpiresAt: token.expiresAt,
        confirmationEmailSentAt: now,
        createdAt: now,
        updatedAt: now,
        ...metadataPatch,
      })
      .returning({ id: waitlistEntry.id })

    return {
      entryId: created.id,
      emailToSend: { email: normalizedEmail, token: token.token },
      adminNotification: {
        entryId: created.id,
        email: normalizedEmail,
        name,
        primaryInterest,
        profileType,
        source: metadataPatch.source,
        useCase,
        utmCampaign: metadataPatch.utmCampaign,
        utmMedium: metadataPatch.utmMedium,
        utmSource: metadataPatch.utmSource,
      },
    }
  }

  if (existing.status === 'pending') {
    if (isWaitlistResendCoolingDown(existing.confirmationEmailSentAt)) {
      await db
        .update(waitlistEntry)
        .set({
          name: name ?? existing.name,
          primaryInterest: primaryInterest ?? existing.primaryInterest,
          profileType: profileType ?? existing.profileType,
          useCase: useCase ?? existing.useCase,
          updatedAt: now,
          ...metadataPatch,
        })
        .where(eq(waitlistEntry.id, existing.id))

      return {
        entryId: existing.id,
        emailToSend: null,
        adminNotification: null,
      }
    }

    const token = issueWaitlistToken(now)
    await db
      .update(waitlistEntry)
      .set({
        name: name ?? existing.name,
        primaryInterest: primaryInterest ?? existing.primaryInterest,
        profileType: profileType ?? existing.profileType,
        useCase: useCase ?? existing.useCase,
        confirmationTokenHash: token.hash,
        confirmationTokenExpiresAt: token.expiresAt,
        confirmationEmailSentAt: now,
        updatedAt: now,
        ...metadataPatch,
      })
      .where(eq(waitlistEntry.id, existing.id))

    return {
      entryId: existing.id,
      emailToSend: { email: normalizedEmail, token: token.token },
      adminNotification: null,
    }
  }

  if (
    TERMINAL_PUBLIC_STATUSES.includes(existing.status as WaitlistEntryStatus)
  ) {
    await db
      .update(waitlistEntry)
      .set({
        name: name ?? existing.name,
        primaryInterest: primaryInterest ?? existing.primaryInterest,
        profileType: profileType ?? existing.profileType,
        useCase: useCase ?? existing.useCase,
        updatedAt: now,
        ...metadataPatch,
      })
      .where(eq(waitlistEntry.id, existing.id))
  }

  return {
    entryId: existing.id,
    emailToSend: null,
    adminNotification: null,
  }
}

export async function consumeWaitlistConfirmationToken(rawToken: string) {
  const tokenHash = hashWaitlistToken(rawToken)
  const now = new Date()
  const [matched] = await db
    .select({
      id: waitlistEntry.id,
    })
    .from(waitlistEntry)
    .where(
      and(
        eq(waitlistEntry.confirmationTokenHash, tokenHash),
        eq(waitlistEntry.status, 'pending'),
        gt(waitlistEntry.confirmationTokenExpiresAt, now)
      )
    )
    .limit(1)

  if (!matched) {
    return null
  }

  const [confirmed] = await db
    .update(waitlistEntry)
    .set({
      status: 'confirmed',
      confirmedAt: now,
      confirmationTokenHash: null,
      confirmationTokenExpiresAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(waitlistEntry.id, matched.id),
        eq(waitlistEntry.confirmationTokenHash, tokenHash),
        eq(waitlistEntry.status, 'pending')
      )
    )
    .returning()

  return confirmed ?? null
}

export async function adminResendWaitlistConfirmation(entryId: string) {
  const entry = await getWaitlistEntryById(entryId)
  if (!entry || entry.status !== 'pending') {
    throw new Error(
      'Only pending waitlist entries can receive confirmation mail'
    )
  }
  const now = new Date()
  const token = issueWaitlistToken(now)
  await db
    .update(waitlistEntry)
    .set({
      confirmationTokenHash: token.hash,
      confirmationTokenExpiresAt: token.expiresAt,
      confirmationEmailSentAt: now,
      updatedAt: now,
    })
    .where(eq(waitlistEntry.id, entry.id))

  return {
    email: entry.email,
    entryId: entry.id,
    token: token.token,
  }
}

export interface AdminDirectInviteInput {
  email: string
  name?: string | null
}

export async function adminEnsureInviteableEntry(
  input: AdminDirectInviteInput
) {
  const normalizedEmail = normalizeWaitlistEmail(input.email)
  const name = normalizeOptionalText(input.name)
  const now = new Date()
  const existing = await getWaitlistEntryByEmail(normalizedEmail)

  if (existing?.status === 'unsubscribed') {
    throw new Error('This address unsubscribed from the waitlist.')
  }

  if (existing) {
    if (existing.status === 'pending') {
      const [confirmed] = await db
        .update(waitlistEntry)
        .set({
          status: 'confirmed',
          confirmedAt: now,
          confirmationTokenHash: null,
          confirmationTokenExpiresAt: null,
          name: name ?? existing.name,
          source: existing.source ?? 'admin-invite',
          updatedAt: now,
        })
        .where(eq(waitlistEntry.id, existing.id))
        .returning()

      if (!confirmed) {
        throw new Error('Waitlist entry not found')
      }

      return confirmed
    }

    if (name && name !== existing.name) {
      const [updated] = await db
        .update(waitlistEntry)
        .set({
          name,
          updatedAt: now,
        })
        .where(eq(waitlistEntry.id, existing.id))
        .returning()

      return updated ?? existing
    }

    return existing
  }

  const [created] = await db
    .insert(waitlistEntry)
    .values({
      id: createWaitlistEntryId(),
      email: normalizedEmail,
      name,
      status: 'confirmed',
      confirmedAt: now,
      source: 'admin-invite',
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!created) {
    throw new Error('Could not create waitlist entry for invite')
  }

  return created
}

export async function adminPrepareWaitlistInvite(entryId: string) {
  const entry = await getWaitlistEntryById(entryId)
  if (
    !(
      entry &&
      ADMIN_INVITEABLE_STATUSES.includes(entry.status as WaitlistEntryStatus)
    )
  ) {
    throw new Error(
      'Only confirmed or invited waitlist entries can receive invites'
    )
  }
  return entry
}

export async function adminMarkWaitlistInvited(entryId: string) {
  const entry = await getWaitlistEntryById(entryId)
  if (
    !(
      entry &&
      ADMIN_INVITEABLE_STATUSES.includes(entry.status as WaitlistEntryStatus)
    )
  ) {
    throw new Error(
      'Only confirmed or invited waitlist entries can be marked invited'
    )
  }
  const now = new Date()
  const [updated] = await db
    .update(waitlistEntry)
    .set({
      status: 'invited',
      inviteEmailSentAt: now,
      invitedAt: entry.invitedAt ?? now,
      updatedAt: now,
    })
    .where(eq(waitlistEntry.id, entry.id))
    .returning()

  if (!updated) {
    throw new Error('Waitlist entry not found')
  }

  return updated
}

export async function adminUpdateWaitlistStatus(
  entryId: string,
  status: 'converted' | 'unsubscribed'
) {
  const now = new Date()
  const [updated] = await db
    .update(waitlistEntry)
    .set({
      status,
      convertedAt: status === 'converted' ? now : null,
      updatedAt: now,
    })
    .where(eq(waitlistEntry.id, entryId))
    .returning()

  if (!updated) {
    throw new Error('Waitlist entry not found')
  }

  return updated
}

export function listWaitlistEntries(filters: WaitlistFilters = {}) {
  const conditions: SQL[] = []
  const search = normalizeOptionalText(filters.search)

  if (search) {
    conditions.push(ilike(waitlistEntry.email, `%${search}%`))
  }
  if (filters.status) {
    conditions.push(eq(waitlistEntry.status, filters.status))
  }
  if (filters.source) {
    conditions.push(eq(waitlistEntry.source, filters.source))
  }
  if (filters.primaryInterest) {
    conditions.push(eq(waitlistEntry.primaryInterest, filters.primaryInterest))
  }
  if (filters.profileType) {
    conditions.push(eq(waitlistEntry.profileType, filters.profileType))
  }
  if (filters.createdWithinDays) {
    const since = new Date(Date.now() - filters.createdWithinDays * 86_400_000)
    conditions.push(gt(waitlistEntry.createdAt, since))
  }

  const query = db.select().from(waitlistEntry)
  return (conditions.length ? query.where(and(...conditions)) : query).orderBy(
    desc(waitlistEntry.createdAt)
  )
}

export async function listWaitlistFilterValues() {
  const sources = await db
    .selectDistinct({ source: waitlistEntry.source })
    .from(waitlistEntry)
    .where(isNotNull(waitlistEntry.source))

  return {
    sources: sources
      .map((row) => row.source)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => left.localeCompare(right)),
  }
}
