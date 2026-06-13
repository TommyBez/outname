import 'server-only'

import { db } from '@outname/db'
import { user } from '@outname/db/schema'
import { asc, eq } from 'drizzle-orm'

export async function listWaitlistAdminEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.role, 'admin'))
    .orderBy(asc(user.email))

  const emails = new Set<string>()
  for (const row of rows) {
    const email = row.email.trim()
    if (email) {
      emails.add(email)
    }
  }

  return [...emails]
}
