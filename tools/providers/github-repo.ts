import 'server-only'

import { z } from 'zod'
import {
  type GitHubCredential,
  githubGitInjectedHeaders,
} from '@/connections/github'
import type { MaintainerTool } from '@/tools/catalog/types'
import {
  defineToolBundle,
  type ToolRuntimeContext,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'
import type { BundleChildToolArgs } from '@/tools/runtime/define-maintainer-tool/types'
import { getOrCreateRepoWorkspace } from '@/tools/runtime/repo-workspace/sandbox'
import type {
  RepoWorkspaceCommandResult,
  RepoWorkspaceReadFileResult,
  RepoWorkspaceWriteFileResult,
} from '@/tools/runtime/repo-workspace/types'

const GITHUB_AUTH_HOSTS = ['github.com', 'api.github.com'] as const
const GITHUB_REPO_MANIFEST_ID = 'github-repo'
const GITHUB_REPO_TOOL_ID = 'github_repo'
const GITHUB_REPO_URL_GUIDE =
  'Use an HTTPS GitHub repository URL such as https://github.com/owner/repo.git.'

const githubRepoConfigSchema = z.object({
  repoUrl: z
    .string()
    .min(1)
    .refine((value) => {
      try {
        parseGitHubRepoUrl(value)
        return true
      } catch {
        return false
      }
    }, GITHUB_REPO_URL_GUIDE)
    .describe(
      'HTTPS GitHub repository URL to clone into the sandboxed repo workspace.'
    ),
})

const bashInputSchema = z.object({
  command: z
    .string()
    .min(1)
    .describe(
      'Bash command to execute from the repository root. Use this for git, grep, tests, builds, scripts, and curl-based GitHub API calls.'
    ),
})

const readFileInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe('Path to read, relative to the repository root.'),
})

const writeFileInputSchema = z.object({
  content: z.string().describe('UTF-8 text content to write to the file.'),
  path: z
    .string()
    .min(1)
    .describe('Path to write, relative to the repository root.'),
})

type GitHubRepoConfig = z.infer<typeof githubRepoConfigSchema>
type BashInput = z.infer<typeof bashInputSchema>
type ReadFileInput = z.infer<typeof readFileInputSchema>
type WriteFileInput = z.infer<typeof writeFileInputSchema>

type ToolExecute<TInput, TOutput> = (input: TInput) => Promise<TOutput>

function parseGitHubRepoUrl(rawUrl: string): { cloneUrl: string } {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    throw new Error(GITHUB_REPO_URL_GUIDE)
  }

  if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
    throw new Error('repoUrl must target https://github.com for this tool.')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'repoUrl must not include credentials, query parameters, or fragments.'
    )
  }

  const [owner, rawRepo, ...rest] = url.pathname
    .split('/')
    .filter((segment) => segment.length > 0)
  if (!(owner && rawRepo) || rest.length > 0) {
    throw new Error(
      'repoUrl must point to a repository path in the form /owner/repo or /owner/repo.git.'
    )
  }

  const repo = rawRepo.endsWith('.git') ? rawRepo.slice(0, -4) : rawRepo
  if (repo.length === 0) {
    throw new Error('repoUrl must include a repository name.')
  }

  return {
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
  }
}

async function getGitHubRepoWorkspace(input: {
  config: GitHubRepoConfig
  ctx: ToolRuntimeContext
}) {
  const repo = parseGitHubRepoUrl(input.config.repoUrl)
  const credential =
    await input.ctx.credentials.read<GitHubCredential>('github')
  return await getOrCreateRepoWorkspace({
    attachmentToolId: input.ctx.attachmentToolId,
    authenticatedHosts: GITHUB_AUTH_HOSTS,
    injectedHeaders: await githubGitInjectedHeaders(credential),
    manifestId: GITHUB_REPO_MANIFEST_ID,
    repoUrl: repo.cloneUrl,
  })
}

const githubRepoTools: Record<string, BundleChildToolArgs<GitHubRepoConfig>> = {
  github_repo_bash: {
    displayName: 'GitHub Repo · Bash',
    description:
      'Execute bash commands from the cloned repository root inside the sandbox. Use this for git, grep, builds, tests, scripts, and curl-based GitHub API calls.',
    inputSchema: bashInputSchema,
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      const execute = workspace.bashTool.bash.execute as ToolExecute<
        BashInput,
        RepoWorkspaceCommandResult
      >
      return toolSuccess(await execute(input as BashInput))
    },
  },
  github_repo_read_file: {
    displayName: 'GitHub Repo · Read File',
    description:
      'Read a UTF-8 text file from the cloned repository using the bash-tool adapter.',
    inputSchema: readFileInputSchema,
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      const execute = workspace.bashTool.tools.readFile.execute as ToolExecute<
        ReadFileInput,
        RepoWorkspaceReadFileResult
      >
      const result = await execute(input as ReadFileInput)
      return toolSuccess(result)
    },
  },
  github_repo_write_file: {
    displayName: 'GitHub Repo · Write File',
    description:
      'Write a UTF-8 text file inside the cloned repository using the bash-tool adapter.',
    inputSchema: writeFileInputSchema,
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      const execute = workspace.bashTool.tools.writeFile.execute as ToolExecute<
        WriteFileInput,
        RepoWorkspaceWriteFileResult
      >
      const result = await execute(input as WriteFileInput)
      return toolSuccess(result)
    },
  },
}

export const githubRepoTool: MaintainerTool = defineToolBundle({
  id: GITHUB_REPO_TOOL_ID,
  category: 'developer',
  displayName: 'GitHub · Repo Workspace',
  description:
    'Clone a configured private GitHub repository into a sandboxed repo workspace and expose the bash-tool adapter so the agent can run git, grep, tests, builds, scripts, and file edits directly inside the repository.',
  capabilities: [
    { kind: 'brokered_http', provider: 'github' },
    { kind: 'tool_sandbox', manifest: GITHUB_REPO_MANIFEST_ID },
  ],
  configSchema: githubRepoConfigSchema,
  sandboxManifestId: GITHUB_REPO_MANIFEST_ID,
  tools: githubRepoTools,
})
