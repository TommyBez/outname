import type { Sandbox } from '@vercel/sandbox'

export interface RepoWorkspaceCommandResult {
  exitCode: number
  stderr: string
  stdout: string
  teeFiles?: Array<{
    command: string
    stdoutFile: string
  }>
}

export interface RepoWorkspaceReadFileResult {
  content: string
}

export interface RepoWorkspaceWriteFileResult {
  success: boolean
}

export interface RepoWorkspaceBashTool {
  execute(input: { command: string }): Promise<RepoWorkspaceCommandResult>
}

export interface RepoWorkspaceReadTool {
  execute(input: { path: string }): Promise<RepoWorkspaceReadFileResult>
}

export interface RepoWorkspaceWriteTool {
  execute(input: {
    content: string
    path: string
  }): Promise<RepoWorkspaceWriteFileResult>
}

export interface RepoWorkspaceBashToolkit {
  bash: RepoWorkspaceBashTool
  tools: {
    bash: RepoWorkspaceBashTool
    readFile: RepoWorkspaceReadTool
    writeFile: RepoWorkspaceWriteTool
  }
}

export interface RepoWorkspace {
  bashTool: RepoWorkspaceBashToolkit
  rootPath: string
  sandbox: Sandbox
}
