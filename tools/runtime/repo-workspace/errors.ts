export class RepoWorkspaceInputError extends Error {
  readonly code = 'invalid_input' as const

  constructor(message: string) {
    super(message)
    this.name = 'RepoWorkspaceInputError'
  }
}

export class RepoWorkspaceProviderError extends Error {
  readonly code = 'provider_error' as const

  constructor(message: string) {
    super(message)
    this.name = 'RepoWorkspaceProviderError'
  }
}
