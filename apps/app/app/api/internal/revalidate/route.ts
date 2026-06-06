import {
  parseAppRevalidationPayload,
  verifyAppRevalidationBody,
} from '@outname/shared/server/app-revalidation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.text()
  if (
    !verifyAppRevalidationBody({
      body,
      signature: req.headers.get('x-outname-revalidation-signature'),
    })
  ) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body) as unknown
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const payload = parseAppRevalidationPayload(parsed)
  if (!payload) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  for (const [tag, profile] of payload.tags) {
    revalidateTag(tag, profile)
  }
  for (const path of payload.paths ?? []) {
    revalidatePath(path)
  }

  return NextResponse.json({ ok: true })
}
