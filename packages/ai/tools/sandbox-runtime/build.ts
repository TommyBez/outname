import 'server-only'
import { db } from '@outname/db'
import { toolSandboxBuilds } from '@outname/db/schema'
import { and, desc, eq } from 'drizzle-orm'

// Used by the tools page to pair a pending attachment row with its latest build.
export async function getLatestBuildForManifest(
  manifestId: string,
  manifestHash?: string
): Promise<{
  id: string
  status: 'pending' | 'running' | 'ready' | 'failed'
  errorText: string | null
} | null> {
  const predicates = [eq(toolSandboxBuilds.manifestId, manifestId)]
  if (manifestHash) {
    predicates.push(eq(toolSandboxBuilds.manifestHash, manifestHash))
  }
  const [row] = await db
    .select({
      id: toolSandboxBuilds.id,
      status: toolSandboxBuilds.status,
      errorText: toolSandboxBuilds.errorText,
    })
    .from(toolSandboxBuilds)
    .where(and(...predicates))
    .orderBy(desc(toolSandboxBuilds.startedAt))
    .limit(1)
  return row ?? null
}
