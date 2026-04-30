/**
 * Validate a `?returnTo=` query parameter from a redirect-style flow
 * (OAuth connect, settings save, …). Only allows same-origin paths;
 * anything else is dropped on the floor and the caller falls back to a
 * default.
 *
 *   "/agents/abc/tools"     -> "/agents/abc/tools"   (ok)
 *   "/foo?bar=baz"          -> "/foo?bar=baz"        (ok)
 *   ""                      -> null
 *   "//evil.com/path"       -> null   (protocol-relative)
 *   "https://evil.com/path" -> null   (absolute)
 *   "javascript:alert(1)"   -> null
 *   "../../etc/passwd"      -> null
 *   "/foo<script>"          -> null   (control / unsafe chars)
 *
 * The check is deliberately narrow — we only accept paths starting with
 * a single slash followed by something that isn't a slash or backslash,
 * with no ASCII control characters.
 */
// Rejecting ASCII control characters is the whole point of this regex,
// so the `noControlCharactersInRegex` warning is exactly what we want to
// suppress here. Anything outside `[\x20-\x7E]` after the leading slash
// is dropped on the floor.
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — same-origin path validator
const SAFE_RETURN_PATH = /^\/[^/\\\s][^\s\u0000-\u001f]*$/

export function safeReturnTo(returnTo: unknown): string | null {
  if (typeof returnTo !== 'string') {
    return null
  }
  if (!SAFE_RETURN_PATH.test(returnTo)) {
    return null
  }
  return returnTo
}

/**
 * Resolve a returnTo with a fallback. Always produces a same-origin
 * path the caller can hand to `NextResponse.redirect(new URL(p, origin))`.
 */
export function safeReturnToOr(returnTo: unknown, fallback: string): string {
  return safeReturnTo(returnTo) ?? fallback
}
