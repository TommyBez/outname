import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/auth/server/auth'
import { denyIfBot } from '@/shared/server/botid-guard'

const handler = toNextJsHandler(auth.handler)

export async function POST(req: Request) {
  const botDenied = await denyIfBot()
  if (botDenied) {
    return botDenied
  }

  return handler.POST(req)
}

export const GET = handler.GET
