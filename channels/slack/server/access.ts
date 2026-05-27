import 'server-only'
import { hasSlackIntegrationAccess } from '@/auth/server/auth-guard'

export async function assertSlackIntegrationAccess(
  userId: string
): Promise<{ error: string; ok: false } | null> {
  if (!(await hasSlackIntegrationAccess(userId))) {
    return {
      ok: false,
      error: 'Slack integration is coming soon for your account.',
    }
  }
  return null
}
