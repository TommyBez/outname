import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth-guard"
import { deleteGmailConnection } from "@/lib/google-oauth"

export async function POST() {
  await requireSession()
  await deleteGmailConnection()
  return NextResponse.json({ ok: true })
}
