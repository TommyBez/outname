import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { runs, digests, digestItems, type Run, type Digest, type DigestItem } from "@/lib/db/schema"

export async function getLatestRun(): Promise<Run | null> {
  const [row] = await db.select().from(runs).orderBy(desc(runs.startedAt)).limit(1)
  return row ?? null
}

export async function getAllRuns(): Promise<Run[]> {
  return db.select().from(runs).orderBy(desc(runs.startedAt)).limit(100)
}

export async function getRunById(runId: string): Promise<Run | null> {
  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  return row ?? null
}

export async function getDigestForRun(runId: string): Promise<Digest | null> {
  const [row] = await db.select().from(digests).where(eq(digests.runId, runId)).limit(1)
  return row ?? null
}

export async function getDigestItems(digestId: string): Promise<DigestItem[]> {
  return db.select().from(digestItems).where(eq(digestItems.digestId, digestId))
}

export async function getDigestWithItems(runId: string) {
  const digest = await getDigestForRun(runId)
  if (!digest) return { digest: null, items: [] }
  const items = await getDigestItems(digest.id)
  return { digest, items }
}
