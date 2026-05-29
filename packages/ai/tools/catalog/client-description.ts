export function clientToolDescription(tool: {
  description: string
  displayDescription?: string
}): string {
  return tool.displayDescription ?? tool.description
}
