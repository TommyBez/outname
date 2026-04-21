/**
 * Shared types for the daily-email-brief agent.
 *
 * The agent now consumes raw Gmail API JSON directly via the generic `gws`
 * tool and shapes it into `GmailMessage` itself — no structural wrapper type
 * is needed here for the Gmail API response.
 */

export interface GmailMessage {
  id: string
  threadId: string
  subject: string
  from: string
  snippet: string
  receivedAt: string // ISO
}
