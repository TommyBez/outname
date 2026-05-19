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
import { toolErrorFromProviderResponse } from '@/tools/runtime/define-maintainer-tool/provider-response'
import type { BundleChildToolArgs } from '@/tools/runtime/define-maintainer-tool/types'
import { RepoWorkspaceInputError } from '@/tools/runtime/repo-workspace/errors'
import {
  grepRepoWorkspaceFiles,
  listRepoWorkspaceFiles,
  readRepoWorkspaceFile,
  writeRepoWorkspaceFiles,
} from '@/tools/runtime/repo-workspace/files'
import {
  commitAndPushRepoWorkspace,
  createRepoWorkspaceBranch,
  currentRepoWorkspaceBranch,
  inspectRepoWorkspaceGit,
  type RepoWorkspaceGitInspectInput,
} from '@/tools/runtime/repo-workspace/git'
import { getOrCreateRepoWorkspace } from '@/tools/runtime/repo-workspace/sandbox'

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const GITHUB_GIT_HOST = 'github.com'
const GITHUB_REPO_MANIFEST_ID = 'github-repo'
const GITHUB_REPO_TOOL_ID = 'github_repo'

const pathSchema = z
  .string()
  .min(1)
  .describe('Path relative to the repository root.')

const repoFileSchema = z.object({
  content: z.string().describe('UTF-8 text content to write to the file.'),
  path: pathSchema,
})

function parseGitHubRepoUrl(rawUrl: string): {
  cloneUrl: string
  owner: string
  repo: string
} {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    throw new Error(
      'repoUrl must be a valid HTTPS GitHub repository URL such as https://github.com/owner/repo.git.'
    )
  }

  if (url.protocol !== 'https:' || url.hostname !== GITHUB_GIT_HOST) {
    throw new Error(
      'repoUrl must target https://github.com for this maintainer tool.'
    )
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
    owner,
    repo,
    cloneUrl: `https://${GITHUB_GIT_HOST}/${owner}/${repo}.git`,
  }
}

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
    }, 'Use an HTTPS GitHub repository URL such as https://github.com/owner/repo.git.')
    .describe(
      'HTTPS URL of the GitHub repository to clone, edit, branch, push, and open pull requests against.'
    ),
  defaultBaseBranch: z
    .string()
    .min(1)
    .default('main')
    .describe(
      'Default base branch for new branches and pull requests, usually main or master.'
    ),
  readOnly: z
    .boolean()
    .default(false)
    .describe(
      'When true, only read-only repo file tools and git inspection tools are exposed.'
    ),
})

const readFileInputSchema = z.object({
  path: pathSchema,
})

const writeFilesInputSchema = z.object({
  files: z
    .array(repoFileSchema)
    .min(1)
    .describe('Files to write relative to the repository root.'),
  confirmWrite: z
    .boolean()
    .default(false)
    .describe(
      'Set true only when you intentionally want to modify files in the repository checkout.'
    ),
})

const listFilesInputSchema = z.object({
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(200)
    .describe('Maximum number of file paths to return.'),
  pathPrefix: z
    .string()
    .optional()
    .describe('Optional path prefix relative to the repository root.'),
})

const grepFilesInputSchema = z.object({
  caseInsensitive: z
    .boolean()
    .default(false)
    .describe('Set true to match without case sensitivity.'),
  fixedString: z
    .boolean()
    .default(false)
    .describe('Set true to search for a literal string instead of a regex.'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe('Maximum number of matches to return.'),
  pathPrefix: z
    .string()
    .optional()
    .describe('Optional path prefix relative to the repository root.'),
  pattern: z.string().min(1).describe('Pattern to search for inside the repo.'),
})

const gitInspectInputSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('status'),
  }),
  z.object({
    operation: z.literal('branches'),
  }),
  z.object({
    operation: z.literal('diff'),
    path: pathSchema.optional(),
    staged: z
      .boolean()
      .default(false)
      .describe(
        'Set true to inspect the staged diff instead of the working tree.'
      ),
  }),
  z.object({
    operation: z.literal('log'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe('Maximum number of git log entries to return.'),
  }),
  z.object({
    operation: z.literal('show'),
    ref: z
      .string()
      .default('HEAD')
      .describe('Commit, branch, or tag reference to show.'),
  }),
])

const createBranchInputSchema = z.object({
  branchName: z.string().min(1).describe('Name of the branch to create.'),
  baseBranch: z
    .string()
    .optional()
    .describe(
      'Optional base branch to branch from. Defaults to the attachment defaultBaseBranch.'
    ),
  confirmBranchCreation: z
    .boolean()
    .default(false)
    .describe(
      'Set true only when you intentionally want to create and checkout a branch in the repo workspace.'
    ),
})

const commitPushInputSchema = z.object({
  branchName: z
    .string()
    .optional()
    .describe(
      'Optional branch name to push. Defaults to the currently checked out branch.'
    ),
  commitMessage: z
    .string()
    .min(1)
    .describe('Commit message to use for the git commit.'),
  authorName: z
    .string()
    .optional()
    .describe('Optional git author name override for the commit.'),
  authorEmail: z
    .string()
    .optional()
    .describe('Optional git author email override for the commit.'),
  confirmPush: z
    .boolean()
    .default(false)
    .describe(
      'Set true only when you intentionally want to create a commit and push it to the remote repository.'
    ),
})

const createPullRequestInputSchema = z.object({
  title: z.string().min(1).describe('Title for the GitHub pull request.'),
  body: z
    .string()
    .optional()
    .describe('Optional markdown body for the pull request.'),
  baseBranch: z
    .string()
    .optional()
    .describe(
      'Optional base branch for the PR. Defaults to the attachment defaultBaseBranch.'
    ),
  headBranch: z
    .string()
    .optional()
    .describe(
      'Optional head branch for the PR. Defaults to the currently checked out branch in the repo workspace.'
    ),
  draft: z
    .boolean()
    .default(true)
    .describe('Create the pull request as a draft by default.'),
  confirmCreatePullRequest: z
    .boolean()
    .default(false)
    .describe(
      'Set true only when you intentionally want to create a GitHub pull request.'
    ),
})

type GitHubRepoConfig = z.infer<typeof githubRepoConfigSchema>
type ReadFileInput = z.infer<typeof readFileInputSchema>
type WriteFilesInput = z.infer<typeof writeFilesInputSchema>
type ListFilesInput = z.infer<typeof listFilesInputSchema>
type GrepFilesInput = z.infer<typeof grepFilesInputSchema>
type CreateBranchInput = z.infer<typeof createBranchInputSchema>
type CommitPushInput = z.infer<typeof commitPushInputSchema>
type CreatePullRequestInput = z.infer<typeof createPullRequestInputSchema>

function mutationPolicy(input: {
  confirmField:
    | 'confirmBranchCreation'
    | 'confirmCreatePullRequest'
    | 'confirmPush'
    | 'confirmWrite'
  confirmMessage: string
}) {
  return ({
    config,
    input: rawInput,
  }: {
    config: GitHubRepoConfig
    input: unknown
  }) => {
    if (config.readOnly) {
      return {
        ok: false as const,
        message:
          'This GitHub repo attachment is configured as read-only, so mutating tools are disabled.',
      }
    }

    const confirmValue =
      typeof rawInput === 'object' && rawInput !== null
        ? (rawInput as Record<string, unknown>)[input.confirmField]
        : undefined

    if (confirmValue !== true) {
      return {
        ok: false as const,
        message: input.confirmMessage,
      }
    }

    return { ok: true as const }
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
    authenticatedHosts: [GITHUB_GIT_HOST],
    injectedHeaders: await githubGitInjectedHeaders(credential),
    manifestId: GITHUB_REPO_MANIFEST_ID,
    repoUrl: repo.cloneUrl,
  })
}

async function createPullRequest(input: {
  config: GitHubRepoConfig
  ctx: ToolRuntimeContext
  value: CreatePullRequestInput
}) {
  const repo = parseGitHubRepoUrl(input.config.repoUrl)
  const workspace = await getGitHubRepoWorkspace({
    config: input.config,
    ctx: input.ctx,
  })
  const baseBranch = input.value.baseBranch ?? input.config.defaultBaseBranch
  const headBranch =
    input.value.headBranch ?? (await currentRepoWorkspaceBranch(workspace))

  if (baseBranch === headBranch) {
    throw new RepoWorkspaceInputError(
      'headBranch and baseBranch must be different for a PR.'
    )
  }

  const response = await input.ctx.http.request('github', {
    method: 'POST',
    url: `${GITHUB_API_BASE}/repos/${repo.owner}/${repo.repo}/pulls`,
    headers: {
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': GITHUB_API_VERSION,
    },
    body: {
      title: input.value.title,
      body: input.value.body,
      head: headBranch,
      base: baseBranch,
      draft: input.value.draft,
    },
    maxResponseBytes: 32 * 1024,
  })

  if (!response.ok) {
    return toolErrorFromProviderResponse(response, {
      label: 'GitHub pull request',
    })
  }

  const parsed = JSON.parse(response.bodyText) as {
    draft?: boolean
    html_url?: unknown
    number?: unknown
    state?: unknown
  }
  if (
    typeof parsed.html_url !== 'string' ||
    typeof parsed.number !== 'number'
  ) {
    throw new Error('GitHub did not return the created pull request metadata.')
  }

  return toolSuccess({
    url: parsed.html_url,
    number: parsed.number,
    state: typeof parsed.state === 'string' ? parsed.state : 'open',
    draft: parsed.draft === true,
    baseBranch,
    headBranch,
  })
}

const githubRepoTools: Record<string, BundleChildToolArgs<GitHubRepoConfig>> = {
  github_repo_read_file: {
    displayName: 'GitHub Repo · Read File',
    description:
      'Read a UTF-8 text file from the attached GitHub repository checkout.',
    inputSchema: readFileInputSchema,
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      return toolSuccess(
        await readRepoWorkspaceFile(workspace, (input as ReadFileInput).path)
      )
    },
  },
  github_repo_write_files: {
    displayName: 'GitHub Repo · Write Files',
    description:
      'Write one or more UTF-8 text files to the attached GitHub repository checkout.',
    inputSchema: writeFilesInputSchema,
    policies: [
      mutationPolicy({
        confirmField: 'confirmWrite',
        confirmMessage:
          'Writing repository files requires confirmWrite=true on this tool call.',
      }),
    ],
    isEnabled(config) {
      return !config.readOnly
    },
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      return toolSuccess(
        await writeRepoWorkspaceFiles(
          workspace,
          (input as WriteFilesInput).files
        )
      )
    },
  },
  github_repo_list_files: {
    displayName: 'GitHub Repo · List Files',
    description:
      'List repository file paths under the attached GitHub repository checkout, excluding .git metadata.',
    inputSchema: listFilesInputSchema,
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      return toolSuccess(
        await listRepoWorkspaceFiles(workspace, input as ListFilesInput)
      )
    },
  },
  github_repo_grep_files: {
    displayName: 'GitHub Repo · Grep Files',
    description:
      'Search repository files for matching text or regex patterns, excluding .git metadata.',
    inputSchema: grepFilesInputSchema,
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      return toolSuccess(
        await grepRepoWorkspaceFiles(workspace, input as GrepFilesInput)
      )
    },
  },
  github_repo_run_git: {
    displayName: 'GitHub Repo · Inspect Git',
    description:
      'Inspect git state in the attached repository using read-only operations such as status, diff, log, and show.',
    inputSchema: gitInspectInputSchema,
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      return toolSuccess(
        await inspectRepoWorkspaceGit({
          workspace,
          value: input as RepoWorkspaceGitInspectInput,
        })
      )
    },
  },
  github_repo_create_branch: {
    displayName: 'GitHub Repo · Create Branch',
    description:
      'Fetch a base branch from origin, create a new local branch from it, and check it out in the repo workspace.',
    inputSchema: createBranchInputSchema,
    policies: [
      mutationPolicy({
        confirmField: 'confirmBranchCreation',
        confirmMessage:
          'Branch creation requires confirmBranchCreation=true on this tool call.',
      }),
    ],
    isEnabled(config) {
      return !config.readOnly
    },
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      const value = input as CreateBranchInput
      return toolSuccess(
        await createRepoWorkspaceBranch({
          workspace,
          branchName: value.branchName,
          baseBranch: value.baseBranch ?? config.defaultBaseBranch,
        })
      )
    },
  },
  github_repo_commit_push: {
    displayName: 'GitHub Repo · Commit & Push',
    description:
      'Create a git commit from local changes in the repo workspace and push the branch to origin.',
    inputSchema: commitPushInputSchema,
    policies: [
      mutationPolicy({
        confirmField: 'confirmPush',
        confirmMessage:
          'Commit and push requires confirmPush=true on this tool call.',
      }),
    ],
    isEnabled(config) {
      return !config.readOnly
    },
    async execute({ config, ctx, input }) {
      const workspace = await getGitHubRepoWorkspace({ config, ctx })
      return toolSuccess(
        await commitAndPushRepoWorkspace({
          workspace,
          ...(input as CommitPushInput),
        })
      )
    },
  },
  github_repo_create_pr: {
    displayName: 'GitHub Repo · Create Pull Request',
    description:
      'Open a GitHub pull request for the attached repository using the configured default base branch or an explicit override.',
    inputSchema: createPullRequestInputSchema,
    policies: [
      mutationPolicy({
        confirmField: 'confirmCreatePullRequest',
        confirmMessage:
          'Pull request creation requires confirmCreatePullRequest=true on this tool call.',
      }),
    ],
    isEnabled(config) {
      return !config.readOnly
    },
    async execute({ config, ctx, input }) {
      return await createPullRequest({
        config,
        ctx,
        value: input as CreatePullRequestInput,
      })
    },
  },
}

export const githubRepoTool: MaintainerTool = defineToolBundle({
  id: GITHUB_REPO_TOOL_ID,
  category: 'developer',
  displayName: 'GitHub · Repo Workspace',
  description:
    'Clone a configured private GitHub repository into a sandboxed repo workspace, inspect and edit files via bash-tool-backed file access, create branches, commit and push changes, and open GitHub pull requests.',
  capabilities: [
    { kind: 'brokered_http', provider: 'github' },
    { kind: 'tool_sandbox', manifest: GITHUB_REPO_MANIFEST_ID },
  ],
  configSchema: githubRepoConfigSchema,
  sandboxManifestId: GITHUB_REPO_MANIFEST_ID,
  tools: githubRepoTools,
})
