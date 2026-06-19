'use client'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@outname/ui/components/ui/alert'
import { Badge } from '@outname/ui/components/ui/badge'
import { Button } from '@outname/ui/components/ui/button'
import { ConfirmActionDialog } from '@outname/ui/components/ui/confirm-action-dialog'
import { Input } from '@outname/ui/components/ui/input'
import { Label } from '@outname/ui/components/ui/label'
import { Skeleton } from '@outname/ui/components/ui/skeleton'
import { Switch } from '@outname/ui/components/ui/switch'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@outname/ui/components/ui/tabs'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BookOpenCheck,
  FileText,
  Github,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type ChangeEvent,
  type SubmitEvent,
  useEffect,
  useReducer,
  useRef,
  useState,
  useTransition,
} from 'react'
import { toast } from 'sonner'

type ManualSkillSourceType = 'github' | 'skill_md' | 'zip'
type SkillSourceType = ManualSkillSourceType | 'skills_sh'

const SKILL_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const SKILL_INTEGER_FORMATTER = new Intl.NumberFormat()
const CATALOG_SKILL_SKELETON_IDS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
] as const

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

interface CatalogSkillView {
  id: string
  installs: number
  installUrl: string | null
  isDuplicate?: boolean
  name: string
  owner: string | null
  slug: string
  source: string
  sourceType: string
  url: string
}

interface CatalogListResult {
  curated: boolean
  message?: string
  ok?: false
  query?: string
  searchType?: string
  skills: CatalogSkillView[]
  totalSkills: number
}

interface CatalogPickerState {
  catalog: CatalogListResult | null
  catalogError: string | null
  catalogPending: boolean
}

interface SkillInstallRequest {
  query: string
}

interface SkillInstallState {
  catalogCurated: boolean
  catalogQuery: string
  conflict: SkillConflict | null
  file: File | null
  githubUrl: string
  manualSourceType: ManualSkillSourceType
}

type SkillInstallAction =
  | { sourceType: ManualSkillSourceType; type: 'setManualSourceType' }
  | { curated: boolean; type: 'setCatalogCurated' }
  | { query: string; type: 'setCatalogQuery' }
  | { githubUrl: string; type: 'setGithubUrl' }
  | { file: File | null; type: 'setFile' }
  | { type: 'clearConflict' }
  | { conflict: SkillConflict; type: 'setConflict' }
  | { type: 'installed' }

type CatalogPickerAction =
  | { catalog: CatalogListResult; type: 'catalogIdle' }
  | { type: 'catalogLoading' }
  | { catalog: CatalogListResult; type: 'catalogLoaded' }
  | { error: string; type: 'catalogFailed' }

const INITIAL_SKILL_INSTALL_STATE: SkillInstallState = {
  catalogCurated: false,
  catalogQuery: '',
  conflict: null,
  file: null,
  githubUrl: '',
  manualSourceType: 'github',
}

const INITIAL_CATALOG_PICKER_STATE: CatalogPickerState = {
  catalog: null,
  catalogError: null,
  catalogPending: false,
}

function resetSkillInstallFields(state: SkillInstallState): SkillInstallState {
  return {
    ...state,
    catalogQuery: '',
    conflict: null,
    file: null,
    githubUrl: '',
    manualSourceType: 'github',
  }
}

function skillInstallReducer(
  state: SkillInstallState,
  action: SkillInstallAction
): SkillInstallState {
  switch (action.type) {
    case 'setManualSourceType':
      return {
        ...state,
        conflict: null,
        file: null,
        manualSourceType: action.sourceType,
      }
    case 'setCatalogCurated':
      return {
        ...state,
        catalogCurated: action.curated,
        conflict: null,
      }
    case 'setCatalogQuery':
      return { ...state, catalogQuery: action.query }
    case 'setGithubUrl':
      return { ...state, githubUrl: action.githubUrl }
    case 'setFile':
      return { ...state, file: action.file }
    case 'clearConflict':
      return { ...state, conflict: null }
    case 'setConflict':
      return { ...state, conflict: action.conflict }
    case 'installed':
      return resetSkillInstallFields(state)
    default:
      return state
  }
}

function catalogPickerReducer(
  state: CatalogPickerState,
  action: CatalogPickerAction
): CatalogPickerState {
  switch (action.type) {
    case 'catalogIdle':
    case 'catalogLoaded':
      return {
        ...state,
        catalog: action.catalog,
        catalogError: null,
        catalogPending: false,
      }
    case 'catalogLoading':
      return {
        ...state,
        catalogError: null,
        catalogPending: true,
      }
    case 'catalogFailed':
      return {
        ...state,
        catalog: null,
        catalogError: action.error,
        catalogPending: false,
      }
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
  const [installRequest, setInstallRequest] =
    useState<SkillInstallRequest | null>(null)
  const installSurfaceRef = useRef<HTMLDivElement>(null)

  function upsertSkill(skill: InstalledSkillView) {
    setSkills((current) => [
      skill,
      ...current.filter((item) => item.slug !== skill.slug),
    ])
  }

  function removeSkill(slug: string) {
    setSkills((current) => current.filter((item) => item.slug !== slug))
  }

  function requestReplace(skill: InstalledSkillView) {
    setInstallRequest({
      query: skill.name,
    })
    installSurfaceRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border border-t pt-6">
        <div className="min-w-0">
          <p className="swiss-label mb-4 text-brand">{agentName}</p>
          <h1 className="font-semibold text-3xl tracking-tight">Skills</h1>
          <p className="mt-5 max-w-2xl text-muted-foreground text-sm leading-relaxed">
            Install one Agent Skill package for this agent and run its scripts
            in the dedicated Skill Sandbox.
          </p>
        </div>
      </header>

      <Alert className="border border-border bg-muted">
        <AlertTriangle className="size-4" />
        <AlertTitle>Skill Sandbox execution</AlertTitle>
        <AlertDescription>
          Skills can run scripts and access the internet inside this
          agent&apos;s Skill Sandbox.
        </AlertDescription>
      </Alert>

      <div ref={installSurfaceRef}>
        <AgentSkillInstallSurface
          agentId={agentId}
          installRequest={installRequest}
          onInstalled={upsertSkill}
        />
      </div>

      <InstalledSkillsList
        agentId={agentId}
        onRemoved={removeSkill}
        onReplaceRequested={requestReplace}
        skills={skills}
      />
    </div>
  )
}

function InstalledSkillsList({
  agentId,
  onRemoved,
  onReplaceRequested,
  skills,
}: {
  agentId: string
  onRemoved: (slug: string) => void
  onReplaceRequested: (skill: InstalledSkillView) => void
  skills: InstalledSkillView[]
}) {
  if (skills.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-start justify-center border border-border border-dashed p-6">
        <BookOpenCheck aria-hidden className="mb-4 size-6 text-brand" />
        <p className="font-semibold font-serif text-2xl leading-none tracking-tighter">
          No skills installed.
        </p>
        <p className="mt-3 max-w-xl text-muted-foreground text-sm">
          Search the catalog or use manual import for GitHub, SKILL.md, and zip
          packages.
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
          onReplaceRequested={onReplaceRequested}
          skill={skill}
        />
      ))}
    </div>
  )
}

function SkillRow({
  agentId,
  onRemoved,
  onReplaceRequested,
  skill,
}: {
  agentId: string
  onRemoved: (slug: string) => void
  onReplaceRequested: (skill: InstalledSkillView) => void
  skill: InstalledSkillView
}) {
  return (
    <article className="grid gap-4 border border-border p-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold font-serif text-2xl leading-none tracking-tighter">
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
        <Button
          className="gap-2"
          onClick={() => onReplaceRequested(skill)}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCw aria-hidden className="size-4" />
          Replace
        </Button>
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
    <div className="min-w-0 border-border border-l pl-3">
      <dt className="font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-mono text-foreground">{value}</dd>
    </div>
  )
}

function AgentSkillInstallSurface({
  agentId,
  installRequest,
  onInstalled,
}: {
  agentId: string
  installRequest: SkillInstallRequest | null
  onInstalled: (skill: InstalledSkillView) => void
}) {
  const [state, dispatch] = useReducer(
    skillInstallReducer,
    INITIAL_SKILL_INSTALL_STATE
  )
  const [pending, startTransition] = useTransition()
  const { refresh } = useRouter()
  const {
    catalogCurated,
    catalogQuery,
    conflict,
    file,
    githubUrl,
    manualSourceType,
  } = state
  const canSubmit = canInstallSkill({
    file,
    githubUrl,
    sourceType: manualSourceType,
  })

  useEffect(() => {
    if (!installRequest) {
      return
    }
    dispatch({ query: installRequest.query, type: 'setCatalogQuery' })
  }, [installRequest])

  function submit(replace: boolean) {
    dispatch({ type: 'clearConflict' })
    startTransition(async () => {
      const result = await installSkill({
        agentId,
        file,
        githubUrl,
        replace,
        sourceType: manualSourceType,
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
    <section className="grid gap-5">
      <div className="grid gap-2 border-border border-t pt-4">
        <p className="swiss-label text-brand">Catalog</p>
        <h2 className="font-semibold text-xl tracking-tight">Add skill</h2>
      </div>

      <SkillCatalogPicker
        agentId={agentId}
        curated={catalogCurated}
        onCuratedChange={(curated) =>
          dispatch({ curated, type: 'setCatalogCurated' })
        }
        onQueryChange={(query) => dispatch({ query, type: 'setCatalogQuery' })}
        query={catalogQuery}
      />

      <form className="grid gap-5" onSubmit={handleSubmit}>
        <ManualSkillSourcePicker
          file={file}
          githubUrl={githubUrl}
          onFileChange={(nextFile) => {
            dispatch({
              sourceType: manualSourceType,
              type: 'setManualSourceType',
            })
            dispatch({ file: nextFile, type: 'setFile' })
          }}
          onGithubUrlChange={(nextGithubUrl) => {
            dispatch({ sourceType: 'github', type: 'setManualSourceType' })
            dispatch({ githubUrl: nextGithubUrl, type: 'setGithubUrl' })
          }}
          onSourceTypeChange={(sourceTypeValue) => {
            dispatch({
              sourceType: sourceTypeValue,
              type: 'setManualSourceType',
            })
          }}
          sourceType={manualSourceType}
        />

        {conflict && <SkillInstallPreview conflict={conflict} />}

        <div className="flex flex-wrap justify-end gap-2">
          {conflict && (
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
          )}
          <Button
            className="gap-2"
            disabled={pending || !canSubmit}
            type="submit"
          >
            <Upload aria-hidden className="size-4" />
            {pending ? 'Installing...' : 'Install'}
          </Button>
        </div>
      </form>
    </section>
  )
}

function SkillCatalogPicker({
  agentId,
  curated,
  onCuratedChange,
  onQueryChange,
  query,
}: {
  agentId: string
  curated: boolean
  onCuratedChange: (curated: boolean) => void
  onQueryChange: (query: string) => void
  query: string
}) {
  const [catalogState, dispatchCatalogState] = useReducer(
    catalogPickerReducer,
    INITIAL_CATALOG_PICKER_STATE
  )
  const { catalog, catalogError, catalogPending } = catalogState
  const trimmedQuery = query.trim()

  useEffect(() => {
    const controller = new AbortController()
    const debounceMs = curated ? 0 : 250

    const timeout = window.setTimeout(() => {
      dispatchCatalogState({ type: 'catalogLoading' })
      async function loadCatalog() {
        try {
          const nextCatalog = await fetchCatalogList({
            curated,
            query: trimmedQuery,
            signal: controller.signal,
          })
          if (!controller.signal.aborted) {
            dispatchCatalogState({
              catalog: nextCatalog,
              type: 'catalogLoaded',
            })
          }
        } catch (error) {
          if (controller.signal.aborted) {
            return
          }
          dispatchCatalogState({
            error:
              error instanceof Error
                ? error.message
                : 'Could not load catalog.',
            type: 'catalogFailed',
          })
        }
      }

      loadCatalog()
    }, debounceMs)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [curated, trimmedQuery])

  const visibleSkills = visibleCatalogSkills({
    curated,
    query: trimmedQuery,
    skills: catalog?.skills ?? [],
  })

  return (
    <section className="grid gap-5 border border-border p-4 lg:p-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="skill-catalog-search">Search catalog</Label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-9"
              id="skill-catalog-search"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={
                curated ? 'Filter curated skills' : 'Search all skills'
              }
              value={query}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 border-border border-l pl-3">
          <Switch
            checked={curated}
            id="skill-catalog-curated"
            onCheckedChange={onCuratedChange}
          />
          <Label htmlFor="skill-catalog-curated">Curated</Label>
        </div>
      </div>

      {catalogError && (
        <Alert className="border border-destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Catalog unavailable</AlertTitle>
          <AlertDescription>{catalogError}</AlertDescription>
        </Alert>
      )}

      <div
        aria-busy={catalogPending}
        className="grid max-h-[520px] gap-2 overflow-y-auto pr-1"
      >
        {catalogPending && <CatalogSkillListSkeleton />}
        {!catalogPending &&
          visibleSkills.map((skill) => (
            <CatalogSkillLink agentId={agentId} key={skill.id} skill={skill} />
          ))}
        {!(catalogPending || catalogError) && visibleSkills.length === 0 && (
          <p className="py-10 text-center text-muted-foreground text-sm">
            {curated
              ? 'No curated skills match this query.'
              : 'No skills found.'}
          </p>
        )}
      </div>
    </section>
  )
}

function CatalogSkillListSkeleton() {
  return CATALOG_SKILL_SKELETON_IDS.map((id) => (
    <div className="grid gap-2 border border-border p-3" key={id}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="mt-0.5 size-4 shrink-0" />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  ))
}

function CatalogSkillLink({
  agentId,
  skill,
}: {
  agentId: string
  skill: CatalogSkillView
}) {
  return (
    <Link
      className="grid gap-2 border border-border p-3 text-left transition-colors hover:bg-muted"
      href={`/agents/${encodeURIComponent(agentId)}/skills/catalog/${encodeCatalogSkillIdForPath(skill.id)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-sm">{skill.name}</span>
          <Badge variant="outline">{skill.sourceType}</Badge>
          {skill.isDuplicate && <Badge variant="secondary">Duplicate</Badge>}
        </div>
        <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0" />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
        <span>{skill.source}</span>
        <span>{formatInteger(skill.installs)} installs</span>
      </div>
    </Link>
  )
}

function ManualSkillSourcePicker({
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
  onSourceTypeChange: (value: ManualSkillSourceType) => void
  sourceType: ManualSkillSourceType
}) {
  return (
    <details className="border border-border p-4">
      <summary className="cursor-pointer font-bold text-sm">
        Manual import
      </summary>
      <Tabs
        className="mt-4"
        onValueChange={(value) =>
          onSourceTypeChange(value as ManualSkillSourceType)
        }
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
    </details>
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
    <div className="grid gap-3 border border-destructive p-4">
      <p className="font-semibold text-destructive text-xs">Name conflict</p>
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
    <div className="border-border border-l pl-3">
      <p className="font-bold text-muted-foreground text-xs">{label}</p>
      <p className="mt-2 font-semibold font-serif text-xl leading-none tracking-tighter">
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
  const { refresh } = useRouter()

  async function handleConfirm() {
    const result = await uninstallSkill(agentId, skill.slug)
    if (!result.ok) {
      throw new Error(result.message ?? 'Uninstall failed.')
    }
    onRemoved(skill.slug)
    toast.success('Skill uninstalled.')
    refresh()
  }

  return (
    <ConfirmActionDialog
      confirmLabel="Uninstall skill"
      description={
        <>
          This removes <strong>{skill.name}</strong> and its files from the
          agent&apos;s Skill Sandbox. The agent will no longer be able to use
          this workflow. This cannot be undone.
        </>
      }
      onConfirm={handleConfirm}
      title={`Uninstall ${skill.name}?`}
      trigger={
        <Button className="gap-2" size="sm" type="button" variant="outline">
          <Trash2 aria-hidden className="size-4" />
          Uninstall
        </Button>
      }
    />
  )
}

async function installSkill(input: {
  agentId: string
  file: File | null
  githubUrl: string
  replace: boolean
  sourceType: ManualSkillSourceType
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

async function fetchCatalogList(input: {
  curated: boolean
  query: string
  signal: AbortSignal
}): Promise<CatalogListResult> {
  const params = new URLSearchParams({
    curated: String(input.curated),
  })
  if (input.query) {
    params.set('query', input.query)
  }

  const response = await fetch(`/api/skills/catalog?${params}`, {
    signal: input.signal,
  })
  const body = (await response
    .json()
    .catch(() => null)) as CatalogListResult | null
  if (!(response.ok && body && Array.isArray(body.skills))) {
    throw new Error(
      body?.message ?? `Catalog request failed (${response.status}).`
    )
  }
  return body
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
    case 'skills_sh':
      return 'Catalog'
    case 'zip':
      return 'Zip'
    default:
      return sourceType
  }
}

function sourceDetail(skill: InstalledSkillView): string {
  if (skill.sourceType === 'github' || skill.sourceType === 'skills_sh') {
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

function formatInteger(value: number): string {
  return SKILL_INTEGER_FORMATTER.format(value)
}

function formatDate(value: string): string {
  return SKILL_DATE_FORMATTER.format(new Date(value))
}

function visibleCatalogSkills(input: {
  curated: boolean
  query: string
  skills: CatalogSkillView[]
}): CatalogSkillView[] {
  if (!(input.curated && input.query)) {
    return input.skills
  }

  const query = input.query.toLocaleLowerCase()
  return input.skills.filter((skill) =>
    [skill.name, skill.source, skill.slug, skill.owner ?? ''].some((value) =>
      value.toLocaleLowerCase().includes(query)
    )
  )
}

function encodeCatalogSkillIdForPath(skillId: string): string {
  return skillId
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function canInstallSkill(input: {
  file: File | null
  githubUrl: string
  sourceType: ManualSkillSourceType
}): boolean {
  if (input.sourceType === 'github') {
    return input.githubUrl.trim().length > 0
  }
  return Boolean(input.file)
}
