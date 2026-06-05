'use client'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@outname/ui/components/ui/alert'
import { Badge } from '@outname/ui/components/ui/badge'
import { Button } from '@outname/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@outname/ui/components/ui/dialog'
import { Input } from '@outname/ui/components/ui/input'
import { Label } from '@outname/ui/components/ui/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@outname/ui/components/ui/tabs'
import {
  AlertTriangle,
  Archive,
  BookOpenCheck,
  FileText,
  Github,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  type ChangeEvent,
  type SubmitEvent,
  useReducer,
  useState,
  useTransition,
} from 'react'
import { toast } from 'sonner'

type SkillSourceType = 'github' | 'skill_md' | 'zip'

const SKILL_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

interface InstalledSkillView {
  contentHash: string
  createdAt: string
  description: string
  fileCount: number
  name: string
  slug: string
  sourcePath: string | null
  sourceRef: string | null
  sourceType: SkillSourceType
  sourceUrl: string | null
  totalBytes: number
  updatedAt: string
}

interface SkillConflict {
  existing: Pick<InstalledSkillView, 'description' | 'name' | 'slug'>
  incoming: {
    description: string
    name: string
  }
}

interface SkillMutationResult {
  code?: string
  conflict?: SkillConflict
  message?: string
  ok: boolean
  replaced?: boolean
  skill?: InstalledSkillView
}

interface AddSkillDialogState {
  conflict: SkillConflict | null
  file: File | null
  githubUrl: string
  open: boolean
  sourceType: SkillSourceType
}

type AddSkillDialogAction =
  | { open: boolean; type: 'setOpen' }
  | { sourceType: SkillSourceType; type: 'setSourceType' }
  | { githubUrl: string; type: 'setGithubUrl' }
  | { file: File | null; type: 'setFile' }
  | { type: 'clearConflict' }
  | { conflict: SkillConflict; type: 'setConflict' }
  | { type: 'installed' }

const INITIAL_ADD_SKILL_DIALOG_STATE: AddSkillDialogState = {
  conflict: null,
  file: null,
  githubUrl: '',
  open: false,
  sourceType: 'github',
}

function resetAddSkillDialogFields(
  state: AddSkillDialogState
): AddSkillDialogState {
  return {
    ...state,
    conflict: null,
    file: null,
    githubUrl: '',
  }
}

function addSkillDialogReducer(
  state: AddSkillDialogState,
  action: AddSkillDialogAction
): AddSkillDialogState {
  switch (action.type) {
    case 'setOpen':
      if (action.open) {
        return { ...state, open: true }
      }
      return resetAddSkillDialogFields({ ...state, open: false })
    case 'setSourceType':
      return {
        ...state,
        conflict: null,
        file: null,
        sourceType: action.sourceType,
      }
    case 'setGithubUrl':
      return { ...state, githubUrl: action.githubUrl }
    case 'setFile':
      return { ...state, file: action.file }
    case 'clearConflict':
      return { ...state, conflict: null }
    case 'setConflict':
      return { ...state, conflict: action.conflict }
    case 'installed':
      return resetAddSkillDialogFields({ ...state, open: false })
    default:
      return state
  }
}

export function AgentSkillsPageContent({
  agentId,
  agentName,
  initialSkills,
}: {
  agentId: string
  agentName: string
  initialSkills: InstalledSkillView[]
}) {
  const [skills, setSkills] = useState(initialSkills)

  function upsertSkill(skill: InstalledSkillView) {
    setSkills((current) => [
      skill,
      ...current.filter((item) => item.slug !== skill.slug),
    ])
  }

  function removeSkill(slug: string) {
    setSkills((current) => current.filter((item) => item.slug !== slug))
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-foreground border-t-4 pt-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="min-w-0">
            <p className="swiss-label mb-4 text-accent">{agentName}</p>
            <h1 className="font-black font-serif text-4xl uppercase leading-[0.9] tracking-tighter sm:text-5xl lg:text-6xl xl:text-7xl">
              Skills
            </h1>
            <p className="mt-5 max-w-2xl border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
              Install one Agent Skill package for this agent and run its scripts
              in the dedicated Skill Sandbox.
            </p>
          </div>
          <AddSkillDialog agentId={agentId} onInstalled={upsertSkill} />
        </div>
      </header>

      <Alert className="border-2 border-foreground bg-muted">
        <AlertTriangle className="size-4" />
        <AlertTitle>Skill Sandbox execution</AlertTitle>
        <AlertDescription>
          Skills can run scripts and access the internet inside this
          agent&apos;s Skill Sandbox.
        </AlertDescription>
      </Alert>

      <InstalledSkillsList
        agentId={agentId}
        onRemoved={removeSkill}
        onReplaced={upsertSkill}
        skills={skills}
      />
    </div>
  )
}

function InstalledSkillsList({
  agentId,
  onRemoved,
  onReplaced,
  skills,
}: {
  agentId: string
  onRemoved: (slug: string) => void
  onReplaced: (skill: InstalledSkillView) => void
  skills: InstalledSkillView[]
}) {
  if (skills.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-start justify-center border-2 border-foreground border-dashed p-6">
        <BookOpenCheck aria-hidden className="mb-4 size-6 text-accent" />
        <p className="font-black font-serif text-2xl uppercase leading-none tracking-tighter">
          No skills installed.
        </p>
        <p className="mt-3 max-w-xl text-muted-foreground text-sm">
          Add a GitHub skill path, upload a SKILL.md file, or upload a zip
          package.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {skills.map((skill) => (
        <SkillRow
          agentId={agentId}
          key={skill.slug}
          onRemoved={onRemoved}
          onReplaced={onReplaced}
          skill={skill}
        />
      ))}
    </div>
  )
}

function SkillRow({
  agentId,
  onRemoved,
  onReplaced,
  skill,
}: {
  agentId: string
  onRemoved: (slug: string) => void
  onReplaced: (skill: InstalledSkillView) => void
  skill: InstalledSkillView
}) {
  return (
    <article className="grid gap-4 border-2 border-foreground p-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-black font-serif text-2xl uppercase leading-none tracking-tighter">
            {skill.name}
          </h2>
          <Badge variant="outline">{sourceLabel(skill.sourceType)}</Badge>
          <Badge variant="secondary">{formatBytes(skill.totalBytes)}</Badge>
        </div>
        <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
          {skill.description}
        </p>
        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <SkillMeta label="Slug" value={skill.slug} />
          <SkillMeta label="Files" value={String(skill.fileCount)} />
          <SkillMeta label="Updated" value={formatDate(skill.updatedAt)} />
          <SkillMeta label="Source" value={sourceDetail(skill)} />
        </dl>
      </div>
      <div className="flex flex-wrap items-start gap-2 md:justify-end">
        <AddSkillDialog
          agentId={agentId}
          onInstalled={onReplaced}
          triggerLabel="Replace"
        />
        <UninstallSkillButton
          agentId={agentId}
          onRemoved={onRemoved}
          skill={skill}
        />
      </div>
    </article>
  )
}

function SkillMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-foreground border-l-2 pl-3">
      <dt className="font-bold text-muted-foreground uppercase tracking-[0.16em]">
        {label}
      </dt>
      <dd className="mt-1 truncate font-mono text-foreground">{value}</dd>
    </div>
  )
}

function AddSkillDialog({
  agentId,
  onInstalled,
  triggerLabel = 'Add skill',
}: {
  agentId: string
  onInstalled: (skill: InstalledSkillView) => void
  triggerLabel?: string
}) {
  const [state, dispatch] = useReducer(
    addSkillDialogReducer,
    INITIAL_ADD_SKILL_DIALOG_STATE
  )
  const [pending, startTransition] = useTransition()
  const { refresh } = useRouter()
  const { conflict, file, githubUrl, open, sourceType } = state

  function handleOpenChange(nextOpen: boolean) {
    dispatch({ open: nextOpen, type: 'setOpen' })
  }

  function submit(replace: boolean) {
    dispatch({ type: 'clearConflict' })
    startTransition(async () => {
      const result = await installSkill({
        agentId,
        file,
        githubUrl,
        replace,
        sourceType,
      })
      if (result.ok && result.skill) {
        onInstalled(result.skill)
        toast.success(result.replaced ? 'Skill replaced.' : 'Skill installed.')
        dispatch({ type: 'installed' })
        refresh()
        return
      }
      if (result.code === 'name_conflict' && result.conflict) {
        dispatch({ conflict: result.conflict, type: 'setConflict' })
        return
      }
      toast.error(result.message ?? 'Skill install failed.')
    })
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    submit(false)
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button className="gap-2" size="sm">
          <Upload aria-hidden className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Install skill</DialogTitle>
          <DialogDescription>
            Add a single Agent Skill package to this agent&apos;s Skill Sandbox.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <SkillSourcePicker
            file={file}
            githubUrl={githubUrl}
            onFileChange={(nextFile) =>
              dispatch({ file: nextFile, type: 'setFile' })
            }
            onGithubUrlChange={(nextGithubUrl) =>
              dispatch({ githubUrl: nextGithubUrl, type: 'setGithubUrl' })
            }
            onSourceTypeChange={(value) => {
              dispatch({ sourceType: value, type: 'setSourceType' })
            }}
            sourceType={sourceType}
          />

          {conflict && <SkillInstallPreview conflict={conflict} />}

          <DialogFooter className="gap-2 sm:justify-between">
            {conflict ? (
              <Button
                className="gap-2"
                disabled={pending}
                onClick={() => submit(true)}
                type="button"
                variant="destructive"
              >
                <RefreshCw aria-hidden className="size-4" />
                Replace
              </Button>
            ) : (
              <span />
            )}
            <Button disabled={pending} type="submit">
              {pending ? 'Installing...' : 'Install'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SkillSourcePicker({
  file,
  githubUrl,
  onFileChange,
  onGithubUrlChange,
  onSourceTypeChange,
  sourceType,
}: {
  file: File | null
  githubUrl: string
  onFileChange: (file: File | null) => void
  onGithubUrlChange: (value: string) => void
  onSourceTypeChange: (value: SkillSourceType) => void
  sourceType: SkillSourceType
}) {
  return (
    <Tabs
      onValueChange={(value) => onSourceTypeChange(value as SkillSourceType)}
      value={sourceType}
    >
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger className="gap-2" value="github">
          <Github aria-hidden className="size-4" />
          GitHub
        </TabsTrigger>
        <TabsTrigger className="gap-2" value="skill_md">
          <FileText aria-hidden className="size-4" />
          SKILL.md
        </TabsTrigger>
        <TabsTrigger className="gap-2" value="zip">
          <Archive aria-hidden className="size-4" />
          Zip
        </TabsTrigger>
      </TabsList>

      <TabsContent className="mt-5" value="github">
        <div className="grid gap-2">
          <Label htmlFor="skill-github-url">GitHub URL</Label>
          <Input
            id="skill-github-url"
            onChange={(event) => onGithubUrlChange(event.target.value)}
            placeholder="https://github.com/owner/repo/tree/main/skill"
            value={githubUrl}
          />
        </div>
      </TabsContent>

      <TabsContent className="mt-5" value="skill_md">
        <SkillFileInput
          accept=".md,text/markdown,text/plain"
          file={file}
          id="skill-md-upload"
          label="SKILL.md file"
          onFileChange={onFileChange}
        />
      </TabsContent>

      <TabsContent className="mt-5" value="zip">
        <SkillFileInput
          accept=".zip,application/zip"
          file={file}
          id="skill-zip-upload"
          label="Zip package"
          onFileChange={onFileChange}
        />
      </TabsContent>
    </Tabs>
  )
}

function SkillFileInput({
  accept,
  file,
  id,
  label,
  onFileChange,
}: {
  accept: string
  file: File | null
  id: string
  label: string
  onFileChange: (file: File | null) => void
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFileChange(event.target.files?.[0] ?? null)
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input accept={accept} id={id} onChange={handleChange} type="file" />
      {file && (
        <p className="font-mono text-muted-foreground text-xs">
          {file.name} · {formatBytes(file.size)}
        </p>
      )}
    </div>
  )
}

function SkillInstallPreview({ conflict }: { conflict: SkillConflict }) {
  return (
    <div className="grid gap-3 border-2 border-destructive p-4">
      <p className="font-black text-destructive text-xs uppercase tracking-[0.16em]">
        Name conflict
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <ConflictPanel
          description={conflict.existing.description}
          label="Installed"
          name={conflict.existing.name}
        />
        <ConflictPanel
          description={conflict.incoming.description}
          label="Incoming"
          name={conflict.incoming.name}
        />
      </div>
    </div>
  )
}

function ConflictPanel({
  description,
  label,
  name,
}: {
  description: string
  label: string
  name: string
}) {
  return (
    <div className="border-foreground border-l-2 pl-3">
      <p className="font-bold text-muted-foreground text-xs uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-2 font-black font-serif text-xl uppercase leading-none tracking-tighter">
        {name}
      </p>
      <p className="mt-2 text-muted-foreground text-sm">{description}</p>
    </div>
  )
}

function UninstallSkillButton({
  agentId,
  onRemoved,
  skill,
}: {
  agentId: string
  onRemoved: (slug: string) => void
  skill: InstalledSkillView
}) {
  const [pending, startTransition] = useTransition()
  const { refresh } = useRouter()

  function handleClick() {
    startTransition(async () => {
      const result = await uninstallSkill(agentId, skill.slug)
      if (!result.ok) {
        toast.error(result.message ?? 'Uninstall failed.')
        return
      }
      onRemoved(skill.slug)
      toast.success('Skill uninstalled.')
      refresh()
    })
  }

  return (
    <Button
      className="gap-2"
      disabled={pending}
      onClick={handleClick}
      size="sm"
      type="button"
      variant="outline"
    >
      <Trash2 aria-hidden className="size-4" />
      Uninstall
    </Button>
  )
}

async function installSkill(input: {
  agentId: string
  file: File | null
  githubUrl: string
  replace: boolean
  sourceType: SkillSourceType
}): Promise<SkillMutationResult> {
  const form = new FormData()
  form.set('kind', input.sourceType)
  form.set('replace', String(input.replace))
  if (input.sourceType === 'github') {
    form.set('url', input.githubUrl)
  } else if (input.file) {
    form.set('file', input.file)
  }

  const response = await fetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/skills`,
    {
      body: form,
      method: 'POST',
    }
  )
  return await readMutationResult(response)
}

async function uninstallSkill(
  agentId: string,
  slug: string
): Promise<SkillMutationResult> {
  const response = await fetch(
    `/api/agents/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(slug)}`,
    { method: 'DELETE' }
  )
  return await readMutationResult(response)
}

async function readMutationResult(
  response: Response
): Promise<SkillMutationResult> {
  const body = (await response
    .json()
    .catch(() => null)) as SkillMutationResult | null
  if (body && typeof body.ok === 'boolean') {
    return body
  }
  return {
    message: `Request failed (${response.status}).`,
    ok: false,
  }
}

function sourceLabel(sourceType: SkillSourceType): string {
  switch (sourceType) {
    case 'github':
      return 'GitHub'
    case 'skill_md':
      return 'SKILL.md'
    case 'zip':
      return 'Zip'
    default:
      return sourceType
  }
}

function sourceDetail(skill: InstalledSkillView): string {
  if (skill.sourceType === 'github') {
    return [skill.sourceUrl, skill.sourceRef, skill.sourcePath]
      .filter(Boolean)
      .join(' · ')
  }
  return sourceLabel(skill.sourceType)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string): string {
  return SKILL_DATE_FORMATTER.format(new Date(value))
}
