'use server'

import { requireWaitlistManageAccess } from '@outname/auth/server/auth-guard'
import {
  sendApplicationInviteEmail,
  sendWaitlistConfirmationEmail,
  sendWaitlistInviteEmail,
} from '@outname/shared/waitlist/server/email'
import {
  adminEnsureInviteableEntry,
  adminMarkWaitlistInvited,
  adminPrepareWaitlistInvite,
  adminResendWaitlistConfirmation,
  adminUpdateWaitlistStatus,
  provisionWaitlistAccess,
} from '@outname/shared/waitlist/server/service'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const entryIdSchema = z.object({
  entryId: z.string().min(1),
})

const statusSchema = z.object({
  entryId: z.string().min(1),
  status: z.enum(['converted', 'unsubscribed']),
})

const inviteUserSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(120).optional(),
})

export type WaitlistAdminActionResult =
  | { ok: true }
  | { error: string; ok: false }

function revalidateWaitlistRoutes() {
  revalidatePath('/settings')
  revalidatePath('/settings/waitlist')
}

function getActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export async function resendWaitlistConfirmationAction(
  entryId: string
): Promise<WaitlistAdminActionResult> {
  await requireWaitlistManageAccess()
  const parsed = entryIdSchema.safeParse({
    entryId,
  })
  if (!parsed.success) {
    return { error: 'Invalid waitlist entry id', ok: false }
  }

  try {
    const message = await adminResendWaitlistConfirmation(parsed.data.entryId)
    await sendWaitlistConfirmationEmail({
      email: message.email,
      token: message.token,
    })
    revalidateWaitlistRoutes()
    return { ok: true }
  } catch (error) {
    return {
      error: getActionErrorMessage(
        error,
        'Could not resend the confirmation email.'
      ),
      ok: false,
    }
  }
}

export async function inviteUserToApplicationAction(
  email: string,
  name?: string
): Promise<WaitlistAdminActionResult> {
  await requireWaitlistManageAccess()
  const parsed = inviteUserSchema.safeParse({
    email,
    name: name?.trim() ? name : undefined,
  })
  if (!parsed.success) {
    return { error: 'Enter a valid email address to invite.', ok: false }
  }

  try {
    const entry = await adminEnsureInviteableEntry(parsed.data)
    await adminPrepareWaitlistInvite(entry.id)
    await provisionWaitlistAccess(entry.id)
    await sendApplicationInviteEmail({
      email: entry.email,
    })
    await adminMarkWaitlistInvited(entry.id)
    revalidateWaitlistRoutes()
    return { ok: true }
  } catch (error) {
    return {
      error: getActionErrorMessage(error, 'Could not send the invite.'),
      ok: false,
    }
  }
}

export async function sendWaitlistInviteAction(
  entryId: string
): Promise<WaitlistAdminActionResult> {
  await requireWaitlistManageAccess()
  const parsed = entryIdSchema.safeParse({
    entryId,
  })
  if (!parsed.success) {
    return { error: 'Invalid waitlist entry id', ok: false }
  }

  try {
    const entry = await adminPrepareWaitlistInvite(parsed.data.entryId)
    await provisionWaitlistAccess(entry.id)
    await sendWaitlistInviteEmail({
      email: entry.email,
    })
    await adminMarkWaitlistInvited(parsed.data.entryId)
    revalidateWaitlistRoutes()
    return { ok: true }
  } catch (error) {
    return {
      error: getActionErrorMessage(error, 'Could not send the invite.'),
      ok: false,
    }
  }
}

export async function updateWaitlistStatusAction(
  entryId: string,
  status: 'converted' | 'unsubscribed'
): Promise<WaitlistAdminActionResult> {
  await requireWaitlistManageAccess()
  const parsed = statusSchema.safeParse({
    entryId,
    status,
  })
  if (!parsed.success) {
    return { error: 'Invalid waitlist status update', ok: false }
  }

  try {
    await adminUpdateWaitlistStatus(parsed.data.entryId, parsed.data.status)
    revalidateWaitlistRoutes()
    return { ok: true }
  } catch (error) {
    return {
      error: getActionErrorMessage(
        error,
        'Could not update the waitlist status.'
      ),
      ok: false,
    }
  }
}
