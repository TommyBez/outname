import 'server-only'

export function roleBypassesAgentCreationLimit(
  role: string | null | undefined
): boolean {
  return (
    role
      ?.split(',')
      .map((value) => value.trim().toLowerCase())
      .includes('admin') ?? false
  )
}
