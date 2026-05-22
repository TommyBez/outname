import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'

type RuntimeRunIdGlobal = typeof globalThis & {
  // Namespaced with the app name to avoid collisions with unrelated packages
  // that may also use globalThis hooks inside the shared Node process.
  __outnameToolRuntimeRunIdGetter?: () => string | undefined
}

const realtimeRunIdStore = new AsyncLocalStorage<string>()

;(globalThis as RuntimeRunIdGlobal).__outnameToolRuntimeRunIdGetter = () =>
  realtimeRunIdStore.getStore()

export function withToolRuntimeRunId<T>(
  runId: string,
  fn: () => Promise<T>
): Promise<T> {
  return realtimeRunIdStore.run(runId, fn)
}
