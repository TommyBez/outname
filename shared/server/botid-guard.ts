import 'server-only'

import { checkBotId } from 'botid/server'
import { NextResponse } from 'next/server'

export async function denyIfBot(): Promise<NextResponse | null> {
  const verification = await checkBotId()

  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  return null
}
