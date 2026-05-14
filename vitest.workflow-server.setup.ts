import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const HOST = '127.0.0.1'
const PORT = '4010'
const SERVER_URL = `http://${HOST}:${PORT}`
const START_TIMEOUT_MS = 45_000
const STDIO_BUFFER_LIMIT = 4000
const NEXT_BINARY = join(process.cwd(), '../../node_modules/.bin/next')

let server: ChildProcessWithoutNullStreams | null = null

function emitSetupLog(
  event: string,
  fields: Record<string, string | number | boolean | null> = {}
): void {
  console.log(
    JSON.stringify({
      scope: 'workflow-server-test',
      event,
      host: HOST,
      port: PORT,
      ...fields,
    })
  )
}

function appendChunk(buffer: string[], chunk: string): void {
  buffer.push(chunk)
  const combined = buffer.join('')
  if (combined.length <= STDIO_BUFFER_LIMIT) {
    return
  }

  buffer.splice(0, buffer.length, combined.slice(-STDIO_BUFFER_LIMIT))
}

async function isServerReady(): Promise<boolean> {
  try {
    const response = await fetch(SERVER_URL)
    return response.status > 0
  } catch {
    return false
  }
}

export async function setup(): Promise<void> {
  const stdout: string[] = []
  const stderr: string[] = []

  emitSetupLog('server_starting', {
    command: `${NEXT_BINARY} dev --hostname ${HOST} --port ${PORT}`,
  })

  server = spawn(NEXT_BINARY, ['dev', '--hostname', HOST, '--port', PORT], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: '1',
      WORKFLOW_TARGET_WORLD: 'local',
    },
    stdio: 'pipe',
  })

  server.stdout.on('data', (data: Buffer) => {
    const message = data.toString()
    appendChunk(stdout, message)
    emitSetupLog('server_stdout', { message: message.trim().slice(-500) })
  })

  server.stderr.on('data', (data: Buffer) => {
    const message = data.toString()
    appendChunk(stderr, message)
    emitSetupLog('server_stderr', { message: message.trim().slice(-500) })
  })

  server.on('error', (error: Error) => {
    emitSetupLog('server_process_error', {
      message: error.message,
      name: error.name,
    })
  })

  server.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
    emitSetupLog('server_exit', {
      code: code ?? 'null',
      signal: signal ?? 'null',
    })
  })

  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      break
    }

    if (await isServerReady()) {
      process.env.WORKFLOW_LOCAL_BASE_URL = SERVER_URL
      process.env.WORKFLOW_TARGET_WORLD = 'local'
      emitSetupLog('server_ready', {
        baseUrl: SERVER_URL,
      })
      await delay(1000)
      return
    }

    await delay(500)
  }

  throw new Error(
    [
      `Server failed to start within ${START_TIMEOUT_MS}ms.`,
      `Command: ${NEXT_BINARY} dev --hostname ${HOST} --port ${PORT}`,
      `WORKFLOW_LOCAL_BASE_URL: ${SERVER_URL}`,
      `Recent stdout:\n${stdout.join('').trim() || '(empty)'}`,
      `Recent stderr:\n${stderr.join('').trim() || '(empty)'}`,
    ].join('\n\n')
  )
}

export async function teardown(): Promise<void> {
  if (!server) {
    return
  }

  emitSetupLog('server_stopping')
  server.kill('SIGTERM')
  await delay(1000)

  if (server.exitCode === null) {
    emitSetupLog('server_force_kill')
    server.kill('SIGKILL')
    await delay(250)
  }
}
