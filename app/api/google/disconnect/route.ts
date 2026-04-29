import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { gmailConnectionTag } from '@/lib/cache-tags'
import { deleteGmailConnection } from '@/lib/google-oauth'

export async function POST() {
  const session = await requireSession()
  await deleteGmailConnection(session.user.id)
  revalidateTag(gmailConnectionTag(session.user.id), 'max')
  revalidatePath('/settings')
  revalidatePath('/')
  return NextResponse.json({ ok: true })
}
