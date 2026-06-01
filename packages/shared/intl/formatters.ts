type DateTimeFormatOptions = Intl.DateTimeFormatOptions

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatOptionsKey(options: DateTimeFormatOptions): string {
  return JSON.stringify(options, Object.keys(options).sort())
}

export function getDateTimeFormat(
  locales: Intl.LocalesArgument,
  options: DateTimeFormatOptions
): Intl.DateTimeFormat {
  const key = `${String(locales)}|${formatOptionsKey(options)}`
  const cached = formatterCache.get(key)
  if (cached) {
    return cached
  }
  const formatter = new Intl.DateTimeFormat(locales, options)
  formatterCache.set(key, formatter)
  return formatter
}

export function formatWithDateTimeFormat(
  locales: Intl.LocalesArgument,
  options: DateTimeFormatOptions,
  date: Date
): string {
  return getDateTimeFormat(locales, options).format(date)
}
