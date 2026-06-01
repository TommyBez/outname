export interface CachedAgentFilePath {
  path: string
}

export function mergeCachedAgentFilePaths(
  existingPaths: string[],
  files: CachedAgentFilePath[]
): string[] {
  return Array.from(
    new Set([...existingPaths, ...files.map((file) => file.path)])
  ).sort()
}
