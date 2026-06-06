'use client'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@outname/ui/components/ui/alert'
import { Button } from '@outname/ui/components/ui/button'
import { AlertTriangle, CheckCircle2, RefreshCw, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

interface InstalledSkillView {
  description: string
  name: string
  slug: string
}

interface SkillConflict {
  existing: InstalledSkillView
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

export function SkillCatalogInstallButton({
  agentId,
  installedSkill,
  skillId,
}: {
  agentId: string
  installedSkill: InstalledSkillView | null
  skillId: string
}) {
  const [conflict, setConflict] = useState<SkillConflict | null>(null)
  const [installedAfterMutation, setInstalledAfterMutation] =
    useState<InstalledSkillView | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const installed = installedAfterMutation ?? installedSkill

  function submit(replace: boolean) {
    setConflict(null)
    startTransition(async () => {
      const result = await installCatalogSkill({ agentId, replace, skillId })
      if (result.ok && result.skill) {
        setInstalledAfterMutation(result.skill)
        toast.success(result.replaced ? 'Skill replaced.' : 'Skill installed.')
        router.refresh()
        return
      }
      if (result.code === 'name_conflict' && result.conflict) {
        setConflict(result.conflict)
        return
      }
      toast.error(result.message ?? 'Skill install failed.')
    })
  }

  return (
    <div className="grid gap-3">
      {installed && (
        <div className="flex items-center gap-2 border-2 border-foreground bg-muted p-3 text-sm">
          <CheckCircle2 aria-hidden className="size-4 shrink-0 text-accent" />
          <span className="font-bold">{installed.name}</span>
          <span className="text-muted-foreground">is installed.</span>
        </div>
      )}

      {conflict && (
        <Alert className="border-2 border-destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Name conflict</AlertTitle>
          <AlertDescription>
            {conflict.existing.name} is already installed. Replace it to update
            this agent with the catalog version.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {conflict ? (
          <Button
            className="gap-2"
            disabled={pending}
            onClick={() => submit(true)}
            type="button"
            variant="destructive"
          >
            <RefreshCw aria-hidden className="size-4" />
            {pending ? 'Replacing...' : 'Replace'}
          </Button>
        ) : (
          <Button
            className="gap-2"
            disabled={pending}
            onClick={() => submit(Boolean(installed))}
            type="button"
            variant={installed ? 'outline' : 'default'}
          >
            {installed ? (
              <RefreshCw aria-hidden className="size-4" />
            ) : (
              <Upload aria-hidden className="size-4" />
            )}
            {buttonLabel({ installed: Boolean(installed), pending })}
          </Button>
        )}
      </div>
    </div>
  )
}

function buttonLabel(input: { installed: boolean; pending: boolean }): string {
  if (input.pending) {
    return input.installed ? 'Replacing...' : 'Installing...'
  }
  return input.installed ? 'Replace installed skill' : 'Install skill'
}

async function installCatalogSkill(input: {
  agentId: string
  replace: boolean
  skillId: string
}): Promise<SkillMutationResult> {
  const form = new FormData()
  form.set('kind', 'skills_sh')
  form.set('id', input.skillId)
  form.set('replace', String(input.replace))

  const response = await fetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/skills`,
    {
      body: form,
      method: 'POST',
    }
  )
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
