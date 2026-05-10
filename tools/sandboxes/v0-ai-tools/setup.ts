export const v0AiToolsSetupScript = String.raw`#!/usr/bin/env bash
set -euo pipefail

RUNNER_DIR="/opt/v0-ai-tools-runner"
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [ ! -f package.json ]; then
  npm init -y >/dev/null 2>&1
fi

npm install --silent @v0-sdk/ai-tools ai >/dev/null 2>&1

cat > "$RUNNER_DIR/runner.mjs" <<'EOF'
import process from 'node:process'
import { v0ToolsByCategory } from '@v0-sdk/ai-tools'

function fail(message) {
  process.stderr.write(message + '\n')
  process.exit(1)
}

function decodeInput(encoded) {
  if (!encoded) {
    return {}
  }

  try {
    const text = Buffer.from(encoded, 'base64url').toString('utf8')
    return JSON.parse(text)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown JSON decode error.'
    fail('Invalid base64url JSON payload: ' + message)
  }
}

const [operation, encodedInput] = process.argv.slice(2)
if (!operation) {
  fail('Missing v0 AI tools operation name.')
}

const toolsByCategory = v0ToolsByCategory()
const tools = {
  ...toolsByCategory.chat,
  ...toolsByCategory.project,
  ...toolsByCategory.deployment,
  ...toolsByCategory.user,
  ...toolsByCategory.hook,
}

const tool = tools[operation]
if (!tool || typeof tool.execute !== 'function') {
  fail('Unknown v0 AI tools operation: ' + operation)
}

const input = decodeInput(encodedInput)

try {
  const result = await tool.execute(input)
  process.stdout.write(JSON.stringify(result ?? null) + '\n')
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  fail(message)
}
EOF

cat > /usr/local/bin/v0-ai-tools-runner <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exec node /opt/v0-ai-tools-runner/runner.mjs "$@"
EOF

chmod +x "$RUNNER_DIR/runner.mjs"
chmod +x /usr/local/bin/v0-ai-tools-runner
`
