import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { Lock, QueueEntry, StateAdapter } from 'chat'
import {
  deleteSlackInstallation,
  loadSlackInstallationByTeam,
  type SlackInstallationPlain,
  saveSlackInstallation,
} from '@/channels/slack/server/installations'
import { createChannelRedisState } from './backing-state'

interface SlackInstallContext {
  userId: string
}

const slackInstallContext = new AsyncLocalStorage<SlackInstallContext>()

export function withSlackInstallContext<T>(
  ctx: SlackInstallContext,
  fn: () => Promise<T>
): Promise<T> {
  return slackInstallContext.run(ctx, fn)
}

const SLACK_INSTALLATION_PREFIX = 'slack:installation:'

function isSlackInstallationKey(key: string): boolean {
  return key.startsWith(SLACK_INSTALLATION_PREFIX)
}

function slackTeamIdFromKey(key: string): string {
  return key.slice(SLACK_INSTALLATION_PREFIX.length)
}

// Intercepts only Slack OAuth installation keys. All runtime state for every
// channel (locks, queues, dedupe, subscriptions, ephemeral values) stays in one
// shared Redis adapter so a single multi-adapter Chat instance can coordinate
// across Fluid Compute instances.
export class ChannelHybridState implements StateAdapter {
  private readonly inner: StateAdapter

  constructor(inner: StateAdapter = createChannelRedisState()) {
    this.inner = inner
  }

  connect(): Promise<void> {
    return this.inner.connect()
  }

  disconnect(): Promise<void> {
    return this.inner.disconnect()
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!isSlackInstallationKey(key)) {
      return this.inner.get<T>(key)
    }
    const teamId = slackTeamIdFromKey(key)
    const row = await loadSlackInstallationByTeam(teamId)
    if (!row) {
      return null
    }
    return row.installation as T
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!isSlackInstallationKey(key)) {
      await this.inner.set(key, value, ttlMs)
      return
    }
    const ctx = slackInstallContext.getStore()
    if (!ctx?.userId) {
      throw new Error(
        'ChannelHybridState: refusing to persist a Slack installation outside a Slack install context. ' +
          'The OAuth callback must wrap handleOAuthCallback in withSlackInstallContext({ userId }, ...).'
      )
    }
    const teamId = slackTeamIdFromKey(key)
    const installation = value as SlackInstallationPlain
    await saveSlackInstallation({
      userId: ctx.userId,
      teamId,
      installation,
    })
  }

  async delete(key: string): Promise<void> {
    if (!isSlackInstallationKey(key)) {
      await this.inner.delete(key)
      return
    }
    const ctx = slackInstallContext.getStore()
    if (!ctx?.userId) {
      console.warn(
        '[channel-state] Slack installation delete without install context',
        { key }
      )
      return
    }
    await deleteSlackInstallation({
      userId: ctx.userId,
      teamId: slackTeamIdFromKey(key),
    })
  }

  async setIfNotExists(
    key: string,
    value: unknown,
    ttlMs?: number
  ): Promise<boolean> {
    if (isSlackInstallationKey(key)) {
      const existing = await this.get(key)
      if (existing) {
        return false
      }
      await this.set(key, value, ttlMs)
      return true
    }
    return this.inner.setIfNotExists(key, value, ttlMs)
  }

  acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
    return this.inner.acquireLock(threadId, ttlMs)
  }

  appendToList(
    key: string,
    value: unknown,
    options?: { maxLength?: number; ttlMs?: number }
  ): Promise<void> {
    return this.inner.appendToList(key, value, options)
  }

  dequeue(threadId: string): Promise<QueueEntry | null> {
    return this.inner.dequeue(threadId)
  }

  enqueue(
    threadId: string,
    entry: QueueEntry,
    maxSize: number
  ): Promise<number> {
    return this.inner.enqueue(threadId, entry, maxSize)
  }

  extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    return this.inner.extendLock(lock, ttlMs)
  }

  forceReleaseLock(threadId: string): Promise<void> {
    return this.inner.forceReleaseLock(threadId)
  }

  getList<T = unknown>(key: string): Promise<T[]> {
    return this.inner.getList<T>(key)
  }

  isSubscribed(threadId: string): Promise<boolean> {
    return this.inner.isSubscribed(threadId)
  }

  queueDepth(threadId: string): Promise<number> {
    return this.inner.queueDepth(threadId)
  }

  releaseLock(lock: Lock): Promise<void> {
    return this.inner.releaseLock(lock)
  }

  subscribe(threadId: string): Promise<void> {
    return this.inner.subscribe(threadId)
  }

  unsubscribe(threadId: string): Promise<void> {
    return this.inner.unsubscribe(threadId)
  }
}
