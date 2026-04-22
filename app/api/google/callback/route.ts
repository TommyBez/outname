import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { revalidatePath, revalidateTag } from "next/cache"
import { requireSession } from "@/lib/auth-guard"
import { gmailConnectionTag } from "@/lib/cache-tags"
import {
  exchangeCodeForTokens,
  fetchUserEmail,
  getRedirectUri,
  upsertGmailConnection,
} from "@/lib/google-oauth"

export async function GET(req: Request) {
  const session = await requireSession()
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  const settingsUrl = new URL("/settings", url.origin)

  if (error) {
    settingsUrl.searchParams.set("gmail", "error")
    settingsUrl.searchParams.set("reason", error)
    return NextResponse.redirect(settingsUrl)
  }

  const jar = await cookies()
  const expectedState = jar.get("google_oauth_state")?.value
  jar.delete("google_oauth_state")

  if (!code || !state || !expectedState || state !== expectedState) {
    settingsUrl.searchParams.set("gmail", "error")
    settingsUrl.searchParams.set("reason", "state_mismatch")
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const redirectUri = getRedirectUri(req.url)
    const tokens = await exchangeCodeForTokens(code, redirectUri)
    if (!tokens.refresh_token) {
      // Happens if the user already authorized and Google skipped the consent.
      // prompt=consent should prevent this, but guard anyway.
      settingsUrl.searchParams.set("gmail", "error")
      settingsUrl.searchParams.set("reason", "no_refresh_token")
      return NextResponse.redirect(settingsUrl)
    }
    const email = await fetchUserEmail(tokens.access_token)
    await upsertGmailConnection({
      userId: session.user.id,
      email,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: tokens.scope,
    })
    revalidateTag(gmailConnectionTag(session.user.id), "max")
    revalidatePath("/settings")
    revalidatePath("/")
    settingsUrl.searchParams.set("gmail", "connected")
    return NextResponse.redirect(settingsUrl)
  } catch (err: any) {
    settingsUrl.searchParams.set("gmail", "error")
    settingsUrl.searchParams.set("reason", err?.message ?? "unknown")
    return NextResponse.redirect(settingsUrl)
  }
}
