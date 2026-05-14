import type { Sandbox } from '@vercel/sandbox'
import type { BashToolkit, CommandResult } from 'bash-tool'

export interface RepoWorkspace {
  bashTool: BashToolkit
  rootPath: string
  sandbox: Sandbox
}

export interface RepoWorkspaceFileWrite {
  content: string
  path: string
}

export interface RepoWorkspaceListInput {
  maxResults?: number
  pathPrefix?: string
}

export interface RepoWorkspaceGrepInput {
  caseInsensitive: boolean
  fixedString: boolean
  maxResults: number
  pathPrefix?: string
  pattern: string
}

export interface RepoWorkspaceGrepMatch {
  line: number
  path: string
  text: string
}

export type RepoWorkspaceCommandResult = CommandResult
