import 'server-only'

import { z } from 'zod'
import {
  type GitHubCredential,
  githubRepoNetworkPolicy,
} from '@/connections/github'
import type { MaintainerTool } from '@/tools/catalog/types'
import {
  defineToolBundle,
  type ToolRuntimeContext,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'
import type { BundleChildToolArgs } from '@/tools/runtime/define-maintainer-tool/types'
import { getOrCreateRepoWorkspace } from '@/tools/runtime/repo-workspace/sandbox'

const GITHUB_REPO_TOOL_ID = 'github_repo'
const GITHUB_CONNECTOR_ID = 'github.personal_access_token'
const GITHUB_REPO_GIT_USERNAME = 'x-access-token'
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
  readOnly: z
    .boolean()
    .default(true)
    .describe(
      'When enabled, the sandbox does not receive brokered GitHub auth after the initial clone and writeFile is hidden.'
    ),
  allowExternalNetwork: z
    .boolean()
    .default(true)
    .describe(
      'When enabled, the repo workspace may reach non-GitHub hosts without injected credentials.'
    ),
})

const bashInputSchema = z.object({
  command: z
    .string()
    .min(1)
    .describe(
      'Bash command to execute from the repository root. Use this for git, grep, tests, builds, scripts, and curl-based GitHub API calls. When readOnly is false, GitHub HTTPS auth is brokered by the sandbox network policy; do not look for env tokens or embed credentials in commands or URLs.'
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

const DANGEROUS_BASH_PATTERNS: Array<{
  description: string
  pattern: RegExp
}> = [
  {
    description: 'git push with force flags',
    pattern: /\bgit\s+push\b[\s\S]*(?:--force\b(?!-with-lease)|-f\b)/i,
  },
  {
    description: 'git push --mirror',
    pattern: /\bgit\s+push\b[\s\S]*--mirror\b/i,
  },
  {
    description: 'git branch force-delete',
    pattern:
      /\bgit\s+branch\b[\s\S]*(?:-D\b|--delete\b[\s\S]*--force\b|--force\b[\s\S]*--delete\b)/i,
  },
  {
    description: 'git reset --hard',
    pattern: /\bgit\s+reset\b[\s\S]*--hard\b/i,
  },
]

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
    await input.ctx.credentials.read<GitHubCredential>(GITHUB_CONNECTOR_ID)
  return await getOrCreateRepoWorkspace({
    attachmentToolId: input.ctx.attachmentToolId,
    gitCredentials: {
      password: credential.token,
      username: GITHUB_REPO_GIT_USERNAME,
    },
    networkPolicy: await githubRepoNetworkPolicy({
      allowExternalNetwork: input.config.allowExternalNetwork,
      credential,
      readOnly: input.config.readOnly,
    }),
    repoUrl: repo.cloneUrl,
  })
}

function denyDangerousBashCommand(input: {
  input: unknown
}): { ok: true } | { ok: false; message: string } {
  const command = bashInputSchema.safeParse(input.input)
  if (!command.success) {
    return { ok: true }
  }

  const matched = DANGEROUS_BASH_PATTERNS.find(({ pattern }) =>
    pattern.test(command.data.command)
  )
  if (!matched) {
    return { ok: true }
  }

  return {
    ok: false,
    message: `Blocked high-risk repo workspace command: ${matched.description}.`,
  }
}

const githubRepoTools: Record<string, BundleChildToolArgs<GitHubRepoConfig>> = {
  github_repo_bash: {
    displayName: 'GitHub Repo · Bash',
    description:
      'Execute bash commands from the cloned GitHub repository root inside the repo workspace. Use this for git, grep, builds, tests, scripts, and curl-based GitHub API calls. When readOnly is false, GitHub HTTPS auth is brokered by the sandbox network policy; no token, username, password, or credential env var is available or needed.',
    inputSchema: bashInputSchema,
    policies: [denyDangerousBashCommand],
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      return toolSuccess(
        await workspace.bashTool.bash.execute(bashInputSchema.parse(input))
      )
    },
  },
  github_repo_read_file: {
    displayName: 'GitHub Repo · Read File',
    description:
      'Read a UTF-8 text file from the cloned GitHub repository using the repo workspace adapter.',
    inputSchema: readFileInputSchema,
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      const result = await workspace.bashTool.tools.readFile.execute(
        readFileInputSchema.parse(input)
      )
      return toolSuccess(result)
    },
  },
  github_repo_write_file: {
    displayName: 'GitHub Repo · Write File',
    description:
      'Write a UTF-8 text file inside the cloned GitHub repository using the repo workspace adapter. Use this for repository file edits instead of generic system-sandbox file tools.',
    inputSchema: writeFileInputSchema,
    isEnabled: (config) => !config.readOnly,
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      const result = await workspace.bashTool.tools.writeFile.execute(
        writeFileInputSchema.parse(input)
      )
      return toolSuccess(result)
    },
  },
}

export const githubRepoTool: MaintainerTool = defineToolBundle({
  id: GITHUB_REPO_TOOL_ID,
  category: 'developer',
  displayName: 'GitHub · Repo Workspace',
  description:
    'Clone a configured private GitHub repository into a sandboxed repo workspace and expose the bash-tool adapter so the agent can run git, grep, tests, builds, scripts, and file edits directly inside the repository. The repo workspace filesystem is separate from the system sandbox; use this bundle for repository files. When readOnly is false, GitHub HTTPS auth is brokered by the sandbox network policy, so no token, username, password, or credential env var is available or needed.',
  capabilities: [{ kind: 'repo_workspace', connectorId: GITHUB_CONNECTOR_ID }],
  configSchema: githubRepoConfigSchema,
  tools: githubRepoTools,
})
