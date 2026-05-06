'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { AgentSkillSourceType } from '@/lib/agent-skill-types'
import {
  addSkillFromGithubAction,
  addSkillFromMarkdownAction,
  addSkillFromZipAction,
  removeSkillAction,
} from '@/lib/skill-actions'

export interface SkillCatalogEntry {
  description: string
  error: string | null
  fileCount: number
  name: string
  sourceRef: string | null
  sourceType: AgentSkillSourceType
  status: 'ready' | 'failed'
  updatedAt: string
}

interface Props {
  agentId: string
  skills: SkillCatalogEntry[]
}

type Mode = 'markdown' | 'zip' | 'github'

const MODE_LABELS: Record<Mode, string> = {
  markdown: 'Paste SKILL.md',
  zip: 'Upload zip',
  github: 'GitHub link',
}

export function SkillCatalog({ agentId, skills }: Props) {
  const [mode, setMode] = useState<Mode>('markdown')
  return (
    <div className="flex flex-col gap-12">
      <section>
        <div className="mb-4 flex flex-wrap gap-2">
          {(['markdown', 'zip', 'github'] as Mode[]).map((m) => (
            <button
              className={`inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors ${
                m === mode
                  ? 'bg-foreground text-background'
                  : 'hover:bg-foreground hover:text-background'
              }`}
              key={m}
              onClick={() => setMode(m)}
              type="button"
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        {mode === 'markdown' ? <MarkdownForm agentId={agentId} /> : null}
        {mode === 'zip' ? <ZipForm agentId={agentId} /> : null}
        {mode === 'github' ? <GithubForm agentId={agentId} /> : null}
      </section>

      <section>
        <h2 className="mb-4 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
          Attached skills ({skills.length})
        </h2>
        {skills.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No skills yet. Add one above; the agent will see it on its next
            session boot.
          </p>
        ) : (
          <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
            {skills.map((s) => (
              <li className="py-6" key={s.name}>
                <SkillRow agentId={agentId} entry={s} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function MarkdownForm({ agentId }: { agentId: string }) {
  const [content, setContent] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit() {
    if (!content.trim()) {
      toast.error('Paste a SKILL.md document first.')
      return
    }
    startTransition(async () => {
      const res = await addSkillFromMarkdownAction({
        agentId,
        content,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Failed to add skill.')
        return
      }
      toast.success(`Skill "${res.name}" added.`)
      setContent('')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Paste a SKILL.md document with YAML frontmatter (<code>name</code> and{' '}
        <code>description</code>). The agent stores a single-file skill.
      </p>
      <textarea
        className="min-h-64 w-full border-2 border-foreground bg-background p-3 font-mono text-xs"
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          '---\nname: my-skill\ndescription: One-paragraph summary of when to use this skill.\n---\n\n# Instructions\n\n...'
        }
        value={content}
      />
      <button
        className="inline-flex h-10 w-fit items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] disabled:opacity-50"
        disabled={pending}
        onClick={handleSubmit}
        type="button"
      >
        {pending ? 'Adding…' : 'Add skill'}
      </button>
    </div>
  )
}

function ZipForm({ agentId }: { agentId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit() {
    if (!file) {
      toast.error('Choose a zip file first.')
      return
    }
    startTransition(async () => {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = arrayBufferToBase64(arrayBuffer)
      const res = await addSkillFromZipAction({
        agentId,
        base64,
        sourceLabel: file.name,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Failed to add skill.')
        return
      }
      toast.success(`Skill "${res.name}" added.`)
      setFile(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Upload a zip whose root contains <code>SKILL.md</code> (or a single
        wrapper folder that does). Subdirectories like <code>scripts/</code> are
        kept and made executable when relevant.
      </p>
      <input
        accept=".zip,application/zip"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        type="file"
      />
      <button
        className="inline-flex h-10 w-fit items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] disabled:opacity-50"
        disabled={pending || !file}
        onClick={handleSubmit}
        type="button"
      >
        {pending ? 'Uploading…' : 'Add skill'}
      </button>
    </div>
  )
}

function GithubForm({ agentId }: { agentId: string }) {
  const [source, setSource] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit() {
    if (!source.trim()) {
      toast.error('Enter a GitHub source.')
      return
    }
    startTransition(async () => {
      const res = await addSkillFromGithubAction({ agentId, source })
      if (!res.ok) {
        toast.error(res.error ?? 'Failed to add skill.')
        return
      }
      toast.success(`Skill "${res.name}" added.`)
      setSource('')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Provide <code>owner/repo/path/to/skill</code>, a full
        <code> github.com</code> URL, or append <code>@ref</code> to pin a
        branch / commit. The path can be the skill directory itself or a parent
        that holds it.
      </p>
      <input
        className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-xs"
        onChange={(e) => setSource(e.target.value)}
        placeholder="coreyhaines31/marketingskills/skills/cold-email"
        type="text"
        value={source}
      />
      <button
        className="inline-flex h-10 w-fit items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] disabled:opacity-50"
        disabled={pending}
        onClick={handleSubmit}
        type="button"
      >
        {pending ? 'Fetching…' : 'Add skill'}
      </button>
    </div>
  )
}

function SkillRow({
  agentId,
  entry,
}: {
  agentId: string
  entry: SkillCatalogEntry
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleRemove() {
    startTransition(async () => {
      const res = await removeSkillAction({ agentId, name: entry.name })
      if (!res.ok) {
        toast.error(res.error ?? 'Failed to remove skill.')
        return
      }
      toast.success(`Skill "${entry.name}" removed.`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-3">
          <h3 className="font-bold font-mono text-base">{entry.name}</h3>
          <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
            {entry.sourceType} · {entry.fileCount} file
            {entry.fileCount === 1 ? '' : 's'}
          </span>
        </div>
        <p className="max-w-2xl text-muted-foreground text-sm">
          {entry.description}
        </p>
        {entry.sourceRef ? (
          <p className="font-mono text-[11px] text-muted-foreground">
            {entry.sourceRef}
          </p>
        ) : null}
        {entry.status === 'failed' && entry.error ? (
          <p className="text-destructive text-xs">{entry.error}</p>
        ) : null}
      </div>
      <button
        className="inline-flex h-10 w-fit items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] hover:bg-foreground hover:text-background disabled:opacity-50"
        disabled={pending}
        onClick={handleRemove}
        type="button"
      >
        {pending ? 'Removing…' : 'Remove'}
      </button>
    </div>
  )
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x80_00
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunk, bytes.length))
    )
  }
  return btoa(binary)
}
