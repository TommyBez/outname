import {
  buildCompactLineDiff,
  getMarkdownChanges,
  getSettingsChanges,
} from './diff'
import type {
  AgentEditMarkdownFiles,
  AgentEditSettings,
  DiffLine,
  MarkdownChange,
  SettingsChange,
} from './types'

export function AgentEditApprovalPreview({
  input,
  currentMarkdownFiles,
  currentSettings,
}: {
  currentMarkdownFiles: AgentEditMarkdownFiles
  currentSettings: AgentEditSettings
  input: unknown
}) {
  const changes = getMarkdownChanges(input, currentMarkdownFiles)
  const settingsChanges = getSettingsChanges(input, currentSettings)

  return (
    <section className="space-y-3">
      <div className="border-2 border-foreground bg-background p-3">
        <p className="font-bold text-xs uppercase tracking-[0.16em]">
          Proposed agent edits
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          {formatApprovalSummary(settingsChanges.length, changes.length)}
        </p>
      </div>
      {settingsChanges.length > 0 ? (
        <SettingsChangePreview changes={settingsChanges} />
      ) : null}
      {changes.map((change) => (
        <MarkdownChangePreview change={change} key={change.path} />
      ))}
    </section>
  )
}

function SettingsChangePreview({ changes }: { changes: SettingsChange[] }) {
  return (
    <section className="border-2 border-foreground bg-background">
      <div className="border-foreground border-b-2 px-3 py-2">
        <p className="font-bold text-xs uppercase tracking-[0.16em]">
          Settings
        </p>
      </div>
      <dl className="divide-y divide-border">
        {changes.map((change) => (
          <div
            className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[8rem_minmax(0,1fr)]"
            key={change.label}
          >
            <dt className="font-bold uppercase tracking-[0.12em]">
              {change.label}
            </dt>
            <dd className="min-w-0 font-mono">
              <span className="text-muted-foreground line-through">
                {change.current}
              </span>
              <span className="mx-2 text-muted-foreground">→</span>
              <span>{change.proposed}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function formatApprovalSummary(
  settingsChangeCount: number,
  markdownChangeCount: number
): string {
  const parts: string[] = []
  if (settingsChangeCount > 0) {
    parts.push(
      `${settingsChangeCount} setting ${settingsChangeCount === 1 ? 'change' : 'changes'}`
    )
  }
  if (markdownChangeCount > 0) {
    parts.push(
      `${markdownChangeCount} markdown ${markdownChangeCount === 1 ? 'file' : 'files'}`
    )
  }
  return parts.length > 0
    ? parts.join(' and ')
    : 'No visible settings or markdown files change in this approval.'
}

function MarkdownChangePreview({ change }: { change: MarkdownChange }) {
  const diff = buildCompactLineDiff(change.current, change.proposed)

  return (
    <section className="border-2 border-foreground bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-foreground border-b-2 px-3 py-2">
        <div>
          <p className="font-bold text-xs uppercase tracking-[0.16em]">
            {change.path}
          </p>
          <p className="text-muted-foreground text-xs">{change.title}</p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em]">
          +{change.addedLineCount} / -{change.removedLineCount}
        </p>
      </div>
      <div className="max-h-80 overflow-auto bg-muted/40 p-3 font-mono text-xs leading-5">
        {diff.map((line) => (
          <DiffLineView key={line.id} line={line} />
        ))}
      </div>
    </section>
  )
}

function DiffLineView({ line }: { line: DiffLine }) {
  if (line.kind === 'omitted') {
    return (
      <div className="text-muted-foreground">
        ... {line.count} unchanged {line.count === 1 ? 'line' : 'lines'}
      </div>
    )
  }

  return (
    <div className={getDiffLineClassName(line.kind)}>
      <span className="select-none text-muted-foreground">
        {getDiffLinePrefix(line.kind)}
      </span>{' '}
      <span>{line.text || ' '}</span>
    </div>
  )
}

function getDiffLinePrefix(kind: DiffLine['kind']): string {
  if (kind === 'added') {
    return '+'
  }
  if (kind === 'removed') {
    return '-'
  }
  return ' '
}

function getDiffLineClassName(kind: DiffLine['kind']): string {
  if (kind === 'added') {
    return 'bg-emerald-500/10 text-emerald-900'
  }
  if (kind === 'removed') {
    return 'bg-destructive/10 text-destructive'
  }
  return 'text-foreground'
}
