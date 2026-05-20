import 'server-only'
import {
  getSystemSandbox,
  SYSTEM_SANDBOX_ROOT,
} from '@/agent-runtime/server/agent-sandbox'
import { mergeCachedAgentFilePaths } from '@/agent-runtime/shared/file-cache-index'
import { listTrackedArchitectureFiles } from '@/agent-runtime/workflows/session/tools/sandbox-file-helpers/list'
import { getUpstashRedis } from '@/shared/server/upstash-redis'

export interface AgentMemoryFile {
  content: string
  path: string
  sha256: string
  updatedAt: Date
}

const FILE_INDEX_SUFFIX = 'files:index'

export async function refreshAgentFileCache(
  agentId: string
): Promise<AgentMemoryFile[]> {
  const sandbox = await getSystemSandbox(agentId)
  const paths = await listTrackedArchitectureFiles(sandbox)
  const files: AgentMemoryFile[] = []

  for (const path of paths) {
    const buf = await sandbox
      .readFileToBuffer({ path: `${SYSTEM_SANDBOX_ROOT}/${path}` })
      .catch(() => null)
    if (!buf) {
      continue
    }
    const content = buf.toString('utf8')
    files.push({
      content,
      path,
      sha256: await sha256Hex(content),
      updatedAt: new Date(),
    })
  }

  await writeCachedAgentFiles(agentId, files)
  return files
}

export async function readAgentFileFromSandbox(input: {
  agentId: string
  path: string
}): Promise<AgentMemoryFile | null> {
  const sandbox = await getSystemSandbox(input.agentId).catch(() => null)
  if (!sandbox) {
    return null
  }

  const buf = await sandbox
    .readFileToBuffer({ path: `${SYSTEM_SANDBOX_ROOT}/${input.path}` })
    .catch(() => null)
  if (!buf) {
    return null
  }

  const content = buf.toString('utf8')
  const file = {
    content,
    path: input.path,
    sha256: await sha256Hex(content),
    updatedAt: new Date(),
  }
  await writeCachedAgentFiles(input.agentId, [file], { merge: true })
  return file
}

export async function listAgentFilesFromSandbox(
  agentId: string
): Promise<AgentMemoryFile[]> {
  return await refreshAgentFileCache(agentId).catch(() => [])
}

export async function readCachedAgentFiles(
  agentId: string
): Promise<AgentMemoryFile[]> {
  const redis = getUpstashRedis()
  if (!redis) {
    return []
  }

  const paths = (await redis.get<string[]>(indexKey(agentId))) ?? []
  if (paths.length === 0) {
    return []
  }

  const records = await Promise.all(
    paths.map((path) =>
      redis.get<CachedAgentMemoryFile>(fileKey(agentId, path))
    )
  )
  return records.flatMap((record) => (record ? [fromCached(record)] : []))
}

export async function readCachedAgentFile(input: {
  agentId: string
  path: string
}): Promise<AgentMemoryFile | null> {
  const redis = getUpstashRedis()
  if (!redis) {
    return null
  }
  const record = await redis.get<CachedAgentMemoryFile>(
    fileKey(input.agentId, input.path)
  )
  return record ? fromCached(record) : null
}

export async function writeCachedAgentFiles(
  agentId: string,
  files: AgentMemoryFile[],
  options: { merge?: boolean } = {}
): Promise<void> {
  const redis = getUpstashRedis()
  if (!redis) {
    return
  }

  const existingPaths = options.merge
    ? ((await redis.get<string[]>(indexKey(agentId))) ?? [])
    : []
  const paths = mergeCachedAgentFilePaths(existingPaths, files)

  await Promise.all([
    redis.set(indexKey(agentId), paths),
    ...files.map((file) =>
      redis.set(fileKey(agentId, file.path), toCached(file))
    ),
  ])
}

function indexKey(agentId: string): string {
  return `agent:${agentId}:${FILE_INDEX_SUFFIX}`
}

function fileKey(agentId: string, path: string): string {
  return `agent:${agentId}:files:${encodeURIComponent(path)}`
}

interface CachedAgentMemoryFile {
  content: string
  path: string
  sha256: string
  updatedAt: string
}

function toCached(file: AgentMemoryFile): CachedAgentMemoryFile {
  return {
    ...file,
    updatedAt: file.updatedAt.toISOString(),
  }
}

function fromCached(file: CachedAgentMemoryFile): AgentMemoryFile {
  return {
    ...file,
    updatedAt: new Date(file.updatedAt),
  }
}

async function sha256Hex(content: string): Promise<string> {
  const encoded = new TextEncoder().encode(content)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Buffer.from(digest).toString('hex')
}
