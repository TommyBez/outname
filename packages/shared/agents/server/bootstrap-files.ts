import 'server-only'
import { createHash } from 'node:crypto'
import {
  ensureSystemSandbox,
  readMarker,
  SYSTEM_SANDBOX_ROOT,
  writeMarker,
} from '@outname/ai/agent-runtime/server/agent-sandbox'
import {
  type AgentMemoryFile,
  writeCachedAgentFiles,
} from '@outname/ai/agent-runtime/server/file-cache'
import {
  buildAgentsMdContent,
  extractAgentsMdCustomInstructions,
} from '@outname/shared/agents/server/agents-md-template'

const BOOTSTRAP_FILE_PATHS = [
  'AGENTS.md',
  'IDENTITY.md',
  'SOUL.md',
  'USER.md',
] as const

export type BootstrapFilePath = (typeof BOOTSTRAP_FILE_PATHS)[number]

const SEED_MARKER_PATH = `${SYSTEM_SANDBOX_ROOT}/.agents-md-seeded`
const SEED_MARKER_VALUE = 'v14-dreaming-runtime'

export async function writeBootstrapFiles(input: {
  agentId: string
  files: Partial<Record<BootstrapFilePath, string>>
}): Promise<void> {
  const { sandbox } = await ensureSystemSandbox(input.agentId)
  await seedBootstrapFilesIfNeeded(input.agentId)

  const files = Object.entries(input.files).map(([path, content]) => ({
    path: `${SYSTEM_SANDBOX_ROOT}/${path}`,
    content: Buffer.from(
      renderBootstrapFile(path as BootstrapFilePath, content)
    ),
  }))

  if (files.length === 0) {
    return
  }

  await sandbox.writeFiles(files)
  const now = new Date()
  const cachedFiles: AgentMemoryFile[] = files.map((file) => {
    const content = file.content.toString('utf8')
    return {
      content,
      path: file.path.slice(`${SYSTEM_SANDBOX_ROOT}/`.length),
      sha256: createHash('sha256').update(content).digest('hex'),
      updatedAt: now,
    }
  })
  await writeCachedAgentFiles(input.agentId, cachedFiles, { merge: true })
}

export async function seedBootstrapFilesIfNeeded(
  agentId: string
): Promise<void> {
  const { sandbox } = await ensureSystemSandbox(agentId)
  const seeded = await readMarker(sandbox, SEED_MARKER_PATH)
  if (seeded === SEED_MARKER_VALUE) {
    return
  }

  await Promise.all([
    writeAgentsMdTemplateIfNeeded({
      path: `${SYSTEM_SANDBOX_ROOT}/AGENTS.md`,
      sandbox,
    }),
    writeDefaultFileIfMissing({
      content: '',
      path: `${SYSTEM_SANDBOX_ROOT}/IDENTITY.md`,
      sandbox,
    }),
  ])
  await writeMarker(sandbox, SEED_MARKER_PATH, SEED_MARKER_VALUE)
}

export function customInstructionsFromAgentsMd(content: string): string {
  return extractAgentsMdCustomInstructions(content)
}

async function writeAgentsMdTemplateIfNeeded(input: {
  path: string
  sandbox: Awaited<ReturnType<typeof ensureSystemSandbox>>['sandbox']
}): Promise<void> {
  const existing = await input.sandbox
    .readFileToBuffer({ path: input.path })
    .catch(() => null)
  const customInstructions = existing
    ? extractAgentsMdCustomInstructions(existing.toString('utf8'))
    : ''
  await input.sandbox.writeFiles([
    {
      content: Buffer.from(buildAgentsMdContent({ customInstructions })),
      path: input.path,
    },
  ])
}

function renderBootstrapFile(path: BootstrapFilePath, content: string): string {
  if (path === 'AGENTS.md') {
    return buildAgentsMdContent({ customInstructions: content })
  }
  return content
}

async function writeDefaultFileIfMissing(input: {
  content: string
  path: string
  sandbox: Awaited<ReturnType<typeof ensureSystemSandbox>>['sandbox']
}): Promise<void> {
  const existing = await input.sandbox
    .readFileToBuffer({ path: input.path })
    .catch(() => null)
  if (existing) {
    return
  }
  await input.sandbox.writeFiles([
    {
      content: Buffer.from(input.content, 'utf8'),
      path: input.path,
    },
  ])
}
