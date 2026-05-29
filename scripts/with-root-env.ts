import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

for (const fileName of ['.env.local', '.env']) {
  const envPath = resolve(workspaceRoot, fileName)
  if (existsSync(envPath)) {
    config({ path: envPath, override: false, quiet: true })
  }
}

const [command, ...args] = process.argv.slice(2)

if (!command) {
  throw new Error('Expected a command to run after loading root env files.')
}

const child = spawn(command, args, {
  env: process.env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

child.on('error', (error) => {
  throw error
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
