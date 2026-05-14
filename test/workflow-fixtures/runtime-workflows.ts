import { createHook, createWebhook, sleep } from 'workflow'

interface ApprovalDecision {
  approved: boolean
  reviewer: string
}

interface PreparedDocument {
  content: string
  id: string
}

export async function approvalWorkflow(documentId: string): Promise<{
  documentId: string
  publicationId?: string
  reviewer: string
  status: 'published' | 'rejected'
}> {
  'use workflow'

  const prepared = await prepareDocumentStep(documentId)

  using approval = createHook<ApprovalDecision>({
    token: `approval:${documentId}`,
  })

  const decision = await approval

  if (!decision.approved) {
    return {
      documentId: prepared.id,
      reviewer: decision.reviewer,
      status: 'rejected',
    }
  }

  await sleep('24h')

  return {
    documentId: prepared.id,
    publicationId: await publishDocumentStep(prepared),
    reviewer: decision.reviewer,
    status: 'published',
  }
}

export async function ingestWebhookWorkflow(endpointId: string): Promise<{
  endpointId: string
  payload: {
    event: string
    orderId: string
  }
}> {
  'use workflow'

  using webhook = createWebhook()
  const request = await webhook

  return {
    endpointId,
    payload: await parseWebhookPayloadStep(await request.text()),
  }
}

export async function serverEchoWorkflow(input: {
  documentId: string
  value: number
}): Promise<{
  documentId: string
  doubled: number
}> {
  'use workflow'

  const prepared = await prepareDocumentStep(input.documentId)
  const doubled = await doubleValueStep(input.value)

  return {
    documentId: prepared.id,
    doubled,
  }
}

async function prepareDocumentStep(
  documentId: string
): Promise<PreparedDocument> {
  'use step'
  await Promise.resolve()

  return {
    content: `content:${documentId}`,
    id: documentId,
  }
}

async function publishDocumentStep(
  document: PreparedDocument
): Promise<string> {
  'use step'
  await Promise.resolve()

  return `pub:${document.id}`
}

async function parseWebhookPayloadStep(body: string): Promise<{
  event: string
  orderId: string
}> {
  'use step'
  await Promise.resolve()

  return JSON.parse(body) as {
    event: string
    orderId: string
  }
}

async function doubleValueStep(value: number): Promise<number> {
  'use step'
  await Promise.resolve()

  return value * 2
}
