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

/**
 * State backing for the Slack Chat SDK adapter.
 *
 * Why custom: the SDK's multi-workspace mode persists every installed
 * workspace's bot token in its `StateAdapter` under
 * `slack:installation:<teamId>`. In a multi-user deployment those bot
 * tokens are owner-scoped — they belong to whichever app user clicked
 * "Add to Slack" — so we route those keys into our `channel_installations`
 * table (encrypted via `connection-crypto.ts`) and let everything else
 * (concurrency locks, thread subscriptions, ephemeral caches) stay in
 * the in-memory adapter.
 *
 * The owning userId is not in scope when the SDK calls `state.set` from
 * inside `handleOAuthCallback`. We carry it through `AsyncLocalStorage`,
 * scoped by `withInstallContext({ userId }, () => ...)` in the OAuth
 * callback route. Reads do not require the userId — the webhook caller
 * separately verifies that `installation.userId === agent.userId`
 * before letting the turn run.
 *
 * Failure modes by design:
 *   - `state.set('slack:installation:<teamId>', ...)` outside an install
 *     context throws — this prevents the SDK from silently dropping a
 *     token write whose owner we cannot determine.
 *   - `state.get('slack:installation:<teamId>')` returns null when the
 *     row is missing or its credential cannot be decrypted, which the
 *     SDK turns into "no token for this team" → the webhook reply path
 *     surfaces that as a clean 401.
 */

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

/**
 * Drop-in `StateAdapter` that intercepts Slack installation keys.
 * Implements the interface explicitly (rather than extending an
 * existing adapter) because the SDK reaches into the adapter through
 * the public interface only — the inner backing can be memory, redis,
 * or anything else that satisfies `StateAdapter`.
 *
 * The default inner is chosen by `createSlackBackingState()`: redis
 * when `REDIS_URL` is set, in-memory otherwise.
 */
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

  // Installation read/write/delete — the only methods that diverge.

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
      // Best-effort delete: removing a token by team id alone is fine
      // because the unique key is `(userId, channel, externalId)` and
      // there is at most one row per (channel, externalId) per user. We
      // log so an unexpected SDK-driven delete is visible.
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

  // Pure pass-through for the rest of the interface.

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
