export function formatNullableAgentDate(value: Date | string | null): string {
  if (!value) {
    return 'Never'
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
