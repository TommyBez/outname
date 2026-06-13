import { describe, expect, it, vi } from 'vitest'
import { ensureParentDirectories } from './write'

describe('ensureParentDirectories', () => {
  it('does not create directories above the sandbox root', async () => {
    const runCommand = vi.fn()

    await ensureParentDirectories({
      paths: ['/vercel/sandbox'],
      root: '/vercel/sandbox',
      sandbox: { runCommand },
    })

    expect(runCommand).not.toHaveBeenCalled()
  })
})
