import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { Lock, QueueEntry, StateAdapter } from 'chat'
import { createSlackBackingState } from './backing-state'
import {
  deleteSlackInstallation,
  loadSlackInstallationByTeam,
  type SlackInstallationPlain,
  saveSlackInstallation,
} from './installations'

interface InstallContext {
  userId: string
}

const installContext = new AsyncLocalStorage<InstallContext>()

export function withInstallContext<T>(
  ctx: InstallContext,
  fn: () => Promise<T>
): Promise<T> {
  return installContext.run(ctx, fn)
}

const INSTALLATION_PREFIX = 'slack:installation:'

function isInstallationKey(key: string): boolean {
  return key.startsWith(INSTALLATION_PREFIX)
}

function teamIdFromKey(key: string): string {
  return key.slice(INSTALLATION_PREFIX.length)
}

// Intercept Slack installation keys so owner-scoped bot tokens live in
// `channel_installations`, while locks and ephemeral state stay in the inner
// adapter chosen by `createSlackBackingState()`.
export class SlackHybridState implements StateAdapter {
  private readonly inner: StateAdapter
  constructor(inner: StateAdapter = createSlackBackingState()) {
    this.inner = inner
  }

  connect(): Promise<void> {
    return this.inner.connect()
  }
  disconnect(): Promise<void> {
    return this.inner.disconnect()
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!isInstallationKey(key)) {
      return this.inner.get<T>(key)
    }
    const teamId = teamIdFromKey(key)
    const row = await loadSlackInstallationByTeam(teamId)
    if (!row) {
      return null
    }
    return row.installation as T
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!isInstallationKey(key)) {
      await this.inner.set(key, value, ttlMs)
      return
    }
    const ctx = installContext.getStore()
    if (!ctx?.userId) {
      throw new Error(
        'SlackHybridState: refusing to persist a Slack installation outside an install context. ' +
          'The OAuth callback must wrap handleOAuthCallback in withInstallContext({ userId }, ...).'
      )
    }
    const teamId = teamIdFromKey(key)
    const installation = value as SlackInstallationPlain
    await saveSlackInstallation({
      userId: ctx.userId,
      teamId,
      installation,
    })
  }

  async delete(key: string): Promise<void> {
    if (!isInstallationKey(key)) {
      await this.inner.delete(key)
      return
    }
    const ctx = installContext.getStore()
    if (!ctx?.userId) {
      // Unexpected SDK delete without owner context should stay visible.
      console.warn(
        '[slack-state] delete without install context — falling back to team-scoped delete',
        { key }
      )
    }
    const teamId = teamIdFromKey(key)
    if (ctx?.userId) {
      await deleteSlackInstallation({ userId: ctx.userId, teamId })
    }
  }

  async setIfNotExists(
    key: string,
    value: unknown,
    ttlMs?: number
  ): Promise<boolean> {
    if (isInstallationKey(key)) {
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
