import { spawnSync } from 'node:child_process'

function run(command, args) {
  const result = spawnSync(command, args, {
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const shouldSkipMigrations = process.env.SKIP_DB_MIGRATE === '1'

if (shouldSkipMigrations) {
  console.log('Skipping database migrations for this API build.')
} else {
  run('pnpm', ['--filter', '@outname/db', 'db:migrate'])
}

run('next', ['build'])
