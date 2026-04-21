/**
 * Shared types for the daily-email-brief agent.
 */

export interface GmailMessage {
  id: string
  threadId: string
  subject: string
  from: string
  snippet: string
  receivedAt: string // ISO
}

export interface GmailApiMessage {
  id: string
  threadId: string
  snippet?: string
  internalDate?: string
  payload?: {
    headers?: { name: string; value: string }[]
  }
}
