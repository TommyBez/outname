'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireWaitlistManageAccess } from '@/auth/server/auth-guard'
import {
  sendWaitlistConfirmationEmail,
  sendWaitlistInviteEmail,
} from '@/waitlist/server/email'
import {
  adminMarkWaitlistInvited,
  adminPrepareWaitlistInvite,
  adminResendWaitlistConfirmation,
  adminUpdateWaitlistStatus,
} from '@/waitlist/server/service'

const entryIdSchema = z.object({
  entryId: z.string().min(1),
})

const statusSchema = z.object({
  entryId: z.string().min(1),
  status: z.enum(['converted', 'unsubscribed']),
})

function revalidateWaitlistRoutes() {
  revalidatePath('/settings')
  revalidatePath('/settings/waitlist')
}

export async function resendWaitlistConfirmationAction(
  formData: FormData
): Promise<void> {
  await requireWaitlistManageAccess()
  const parsed = entryIdSchema.safeParse({
    entryId: formData.get('entryId'),
  })
  if (!parsed.success) {
    throw new Error('Invalid waitlist entry id')
  }

  const message = await adminResendWaitlistConfirmation(parsed.data.entryId)
  await sendWaitlistConfirmationEmail({
    email: message.email,
    token: message.token,
  })
  revalidateWaitlistRoutes()
}

export async function sendWaitlistInviteAction(
  formData: FormData
): Promise<void> {
  await requireWaitlistManageAccess()
  const parsed = entryIdSchema.safeParse({
    entryId: formData.get('entryId'),
  })
  if (!parsed.success) {
    throw new Error('Invalid waitlist entry id')
  }

  const entry = await adminPrepareWaitlistInvite(parsed.data.entryId)
  await sendWaitlistInviteEmail({
    email: entry.email,
  })
  await adminMarkWaitlistInvited(parsed.data.entryId)
  revalidateWaitlistRoutes()
}

export async function updateWaitlistStatusAction(
  formData: FormData
): Promise<void> {
  await requireWaitlistManageAccess()
  const parsed = statusSchema.safeParse({
    entryId: formData.get('entryId'),
    status: formData.get('status'),
  })
  if (!parsed.success) {
    throw new Error('Invalid waitlist status update')
  }

  await adminUpdateWaitlistStatus(parsed.data.entryId, parsed.data.status)
  revalidateWaitlistRoutes()
}
