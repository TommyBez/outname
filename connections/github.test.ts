import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { githubRepoNetworkPolicy } from './github'

describe('githubRepoNetworkPolicy', () => {
  it('brokers GitHub API and git credentials with host-specific headers', async () => {
    const token = 'ghp_test-token'
    const policy = await githubRepoNetworkPolicy({ token })
    const basicToken = Buffer.from(`x-access-token:${token}`, 'utf8').toString(
      'base64'
    )

    expect(policy).toEqual({
      allow: {
        'api.github.com': [
          { transform: [{ headers: { Authorization: `Bearer ${token}` } }] },
        ],
        'uploads.github.com': [
          { transform: [{ headers: { Authorization: `Bearer ${token}` } }] },
        ],
        'codeload.github.com': [
          { transform: [{ headers: { Authorization: `Bearer ${token}` } }] },
        ],
        'github.com': [
          {
            transform: [
              {
                headers: {
                  Authorization: `Basic ${basicToken}`,
                },
              },
            ],
          },
        ],
        '*': [],
      },
    })
  })
})
