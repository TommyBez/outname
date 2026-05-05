const S3_PRESIGNED_QUERY_KEYS = [
  'X-Amz-Algorithm',
  'X-Amz-Credential',
  'X-Amz-Signature',
] as const

function isAmazonS3Host(hostname: string): boolean {
  const host = hostname.toLowerCase()

  if (host === 's3.amazonaws.com' || host.endsWith('.s3.amazonaws.com')) {
    return true
  }

  if (host.startsWith('s3.') && host.endsWith('.amazonaws.com')) {
    return true
  }

  if (host.includes('.s3.') && host.endsWith('.amazonaws.com')) {
    return true
  }

  return host.endsWith('.s3-accelerate.amazonaws.com')
}

function hasS3PresignedQuery(url: URL): boolean {
  return S3_PRESIGNED_QUERY_KEYS.every((key) => url.searchParams.has(key))
}

export function isTypefullyPresignedUploadRequest(input: {
  method: string
  url: URL
}): boolean {
  return (
    input.method.toUpperCase() === 'PUT' &&
    input.url.protocol === 'https:' &&
    input.url.username === '' &&
    input.url.password === '' &&
    isAmazonS3Host(input.url.hostname) &&
    hasS3PresignedQuery(input.url)
  )
}
