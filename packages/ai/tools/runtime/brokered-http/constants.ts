export const DEFAULT_TIMEOUT_MS = 30_000
export const DEFAULT_MAX_RESPONSE_BYTES = 12_000
export const MAX_RESPONSE_BYTES = 256 * 1024
export const MAX_STDERR_BYTES = 2000

export const FETCH_RUNNER = `
const input = JSON.parse(Buffer.from(process.argv[1], 'base64url').toString('utf8'));
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), input.timeoutMs);
try {
  const response = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.bodyText,
    signal: controller.signal,
  });
  const buf = Buffer.from(await response.arrayBuffer());
  const clipped = buf.subarray(0, input.maxResponseBytes);
  const headers = {};
  for (const key of ['content-type', 'retry-after']) {
    const value = response.headers.get(key);
    if (value) headers[key] = value;
  }
  console.log(JSON.stringify({
    ok: response.ok,
    status: response.status,
    headers,
    bodyText: clipped.toString('utf8'),
    truncated: buf.length > input.maxResponseBytes,
  }));
} finally {
  clearTimeout(timer);
}
`
