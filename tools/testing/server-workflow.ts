// Test-only workflow fixture kept in source so the Next.js workflow manifest
// registers it for server-based integration tests.
export async function serverEchoWorkflow(input: {
  documentId: string
  value: number
}): Promise<{
  documentId: string
  doubled: number
}> {
  'use workflow'

  return {
    documentId: input.documentId,
    doubled: await doubleValueStep(input.value),
  }
}

async function doubleValueStep(value: number): Promise<number> {
  'use step'
  await Promise.resolve()

  return value * 2
}
