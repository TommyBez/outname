import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.turbo',
  'dist',
  'node_modules',
  'test',
])
const workflowPackagePrefix = 'packages/workflow/'
const frontendAppPrefixes = ['apps/app/', 'apps/web/', 'apps/admin/']
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts'])

const directWorkflowImportPattern =
  /from\s+['"]workflow(?:\/api|\/next)?['"]|import\s+['"]workflow(?:\/api|\/next)?['"]/g
const workflowDirectivePattern = /['"]use workflow['"]/g
const appWorkflowImportPattern = /@outname\/workflow/g

const violations: string[] = []

for (const file of walk(root)) {
  const rel = relative(root, file)
  if (!isSourceFile(rel)) {
    continue
  }
  const normalized = rel.split('\\').join('/')
  if (normalized === 'scripts/check-workflow-boundaries.ts') {
    continue
  }
  const isApiNextConfig = normalized === 'apps/api/next.config.ts'
  const source = readFileSync(file, 'utf8')

  if (!(normalized.startsWith(workflowPackagePrefix) || isApiNextConfig)) {
    collectMatches({
      file: normalized,
      label: 'direct workflow SDK import outside packages/workflow',
      pattern: directWorkflowImportPattern,
      source,
    })
    collectMatches({
      file: normalized,
      label: '"use workflow" directive outside packages/workflow',
      pattern: workflowDirectivePattern,
      source,
    })
  }

  if (frontendAppPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    collectMatches({
      file: normalized,
      label: '@outname/workflow import inside frontend app',
      pattern: appWorkflowImportPattern,
      source,
    })
  }
}

if (violations.length > 0) {
  console.error('Workflow boundary check failed:')
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log('Workflow boundary check passed.')

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirectories.has(entry)) {
      continue
    }
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      yield* walk(path)
      continue
    }
    if (stat.isFile()) {
      yield path
    }
  }
}

function isSourceFile(path: string): boolean {
  if (path.includes('.test.') || path.includes('.unit.test.')) {
    return false
  }
  for (const extension of sourceExtensions) {
    if (path.endsWith(extension)) {
      return true
    }
  }
  return false
}

function collectMatches(input: {
  file: string
  label: string
  pattern: RegExp
  source: string
}): void {
  input.pattern.lastIndex = 0
  const lines = input.source.split('\n')
  for (const match of input.source.matchAll(input.pattern)) {
    const line = lineForIndex(lines, match.index ?? 0)
    violations.push(`${input.file}:${line} ${input.label}`)
  }
}

function lineForIndex(lines: string[], index: number): number {
  let cursor = 0
  for (let i = 0; i < lines.length; i += 1) {
    cursor += lines[i].length + 1
    if (cursor > index) {
      return i + 1
    }
  }
  return lines.length
}
