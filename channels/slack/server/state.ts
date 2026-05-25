import 'server-only'

import {
  ChannelHybridState,
  withSlackInstallContext,
} from '@/channels/server/state'

interface SlackInstallContext {
  userId: string
}

export class SlackHybridState extends ChannelHybridState {}

export function withInstallContext<T>(
  ctx: SlackInstallContext,
  fn: () => Promise<T>
): Promise<T> {
  return withSlackInstallContext(ctx, fn)
}
