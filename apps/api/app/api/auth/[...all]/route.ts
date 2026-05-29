import { auth } from '@outname/auth/server/auth'
import { denyIfBot } from '@outname/shared/server/botid-guard'
import { toNextJsHandler } from 'better-auth/next-js'

const handler = toNextJsHandler(auth.handler)

export async function POST(req: Request) {
  const botDenied = await denyIfBot()
  if (botDenied) {
    return botDenied
  }

  return handler.POST(req)
}

export const GET = handler.GET
