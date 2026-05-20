export const X_OAUTH_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',
  'like.read',
  'like.write',
  'follows.read',
  'follows.write',
  'bookmark.read',
  'bookmark.write',
  'media.write',
] as const

export const X_OAUTH_SCOPE_CATALOG = [
  { scope: 'tweet.read', label: 'Read tweets' },
  { scope: 'tweet.write', label: 'Post and manage tweets' },
  { scope: 'users.read', label: 'Read user profiles' },
  { scope: 'offline.access', label: 'Stay connected offline' },
  { scope: 'like.read', label: 'Read likes' },
  { scope: 'like.write', label: 'Like and unlike tweets' },
  { scope: 'follows.read', label: 'Read follows' },
  { scope: 'follows.write', label: 'Follow and unfollow accounts' },
  { scope: 'bookmark.read', label: 'Read bookmarks' },
  { scope: 'bookmark.write', label: 'Manage bookmarks' },
  { scope: 'media.write', label: 'Upload media' },
] as const
