import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { BOOTSTRAP_FILE_OPTIONS, type BootstrapFileValue } from './options'

interface BootstrapFilesProps {
  activeBootstrapFile: BootstrapFileValue
  identity: string
  identityCard: string
  instructions: string
  setActiveBootstrapFile: (value: BootstrapFileValue) => void
  setIdentity: (value: string) => void
  setIdentityCard: (value: string) => void
  setInstructions: (value: string) => void
  setUserProfile: (value: string) => void
  userProfile: string
}

export function BootstrapFiles(props: BootstrapFilesProps) {
  return (
    <div className="grid gap-3 border-foreground border-b-2 pb-8 md:grid-cols-[12rem_minmax(0,1fr)]">
      <div>
        <Label>Bootstrap files</Label>
      </div>
      <div>
        <p className="mb-4 max-w-2xl text-muted-foreground text-xs leading-relaxed">
          {
            "These four files are inlined into the agent's system prompt on every event when present. IDENTITY.md is the quick persona card, SOUL.md is the deeper personality layer, AGENTS.md is the operating manual, and USER.md is the user profile. The agent can read them via readFile, but only USER.md remains agent-maintained."
          }
        </p>
        <BootstrapFilePicker
          activeBootstrapFile={props.activeBootstrapFile}
          setActiveBootstrapFile={props.setActiveBootstrapFile}
        />
        <Tabs className="mt-3" value={props.activeBootstrapFile}>
          <TabsContent className="mt-3" value="identity-card">
            <Textarea
              className="font-mono text-sm"
              id="agent-identity-card"
              onChange={(e) => props.setIdentityCard(e.target.value)}
              placeholder={
                'A compact first-impression card. Example:\nYou are ROOK.\nRole: snarky research associate + code reviewer\nVibe: Unreasonably cheerful, terminally online, but surprisingly wise.\nEmoji: 🐙\nSign-off: "Over and out, meatbag."'
              }
              rows={10}
              value={props.identityCard}
            />
            <p className="mt-2 text-muted-foreground text-xs">
              Saved to <span className="font-mono">IDENTITY.md</span> in the
              agent&apos;s memory volume. Keep it short and scannable.
            </p>
          </TabsContent>
          <TabsContent className="mt-3" value="identity">
            <Textarea
              className="font-mono text-sm"
              id="agent-identity"
              onChange={(e) => props.setIdentity(e.target.value)}
              placeholder={
                'Deeper persona guidance: voice, tone, values, preferences, habits, and boundaries. Empty is fine — the agent will lean on IDENTITY.md plus its built-in defaults.'
              }
              rows={12}
              value={props.identity}
            />
            <p className="mt-2 text-muted-foreground text-xs">
              Saved to <span className="font-mono">SOUL.md</span> in the
              agent&apos;s memory volume for the long-form persona layer.
            </p>
          </TabsContent>
          <TabsContent className="mt-3" value="instructions">
            <Textarea
              className="font-mono text-sm"
              id="agent-instructions"
              onChange={(e) => props.setInstructions(e.target.value)}
              placeholder={
                'Operating manual. What does this agent do during heartbeats? Which memory files matter? When should it ping the user? Empty falls back to the platform default template.'
              }
              rows={12}
              value={props.instructions}
            />
            <p className="mt-2 text-muted-foreground text-xs">
              Saved to <span className="font-mono">AGENTS.md</span> in the
              agent&apos;s memory volume.
            </p>
          </TabsContent>
          <TabsContent className="mt-3" value="user-profile">
            <Textarea
              className="font-mono text-sm"
              id="agent-user-profile"
              onChange={(e) => props.setUserProfile(e.target.value)}
              placeholder={
                '## Basic Info\n- What to call me:\n- My timezone:\n\n## My World\n- Current projects, role, usual tasks.\n\n## Communication Style\n- I like:\n- I dislike:\n\n## Delivery Preferences\n- Formatting, language, code, or review preferences.\n\n## Hard Boundaries\n- Actions forbidden without explicit approval.'
              }
              rows={12}
              value={props.userProfile}
            />
            <p className="mt-2 text-muted-foreground text-xs">
              Seeds or corrects <span className="font-mono">USER.md</span>. The
              agent can update this file as it learns stable facts.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function BootstrapFilePicker({
  activeBootstrapFile,
  setActiveBootstrapFile,
}: {
  activeBootstrapFile: BootstrapFileValue
  setActiveBootstrapFile: (value: BootstrapFileValue) => void
}) {
  return (
    <>
      <div className="mb-3 flex flex-col gap-2 md:hidden">
        <Label
          className="font-bold text-xs uppercase tracking-[0.14em]"
          htmlFor="bootstrap-file-view"
        >
          File view
        </Label>
        <Select
          onValueChange={(value) =>
            setActiveBootstrapFile(value as BootstrapFileValue)
          }
          value={activeBootstrapFile}
        >
          <SelectTrigger
            className="w-full text-left normal-case tracking-normal"
            id="bootstrap-file-view"
          >
            <SelectValue placeholder="Choose a bootstrap file" />
          </SelectTrigger>
          <SelectContent align="start" position="popper">
            {BOOTSTRAP_FILE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {`${option.label} (${option.fileName})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Pick one file at a time on smaller screens.
        </p>
      </div>
      <div className="hidden gap-2 md:grid md:grid-cols-2 xl:grid-cols-4">
        {BOOTSTRAP_FILE_OPTIONS.map((option) => {
          const isActive = activeBootstrapFile === option.value
          return (
            <Button
              aria-pressed={isActive}
              className={cn(
                'flex min-h-16 flex-col items-start justify-between gap-2 border-2 px-4 py-3 text-left transition-colors',
                isActive
                  ? 'border-foreground bg-muted text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              )}
              key={option.value}
              onClick={() => setActiveBootstrapFile(option.value)}
              type="button"
            >
              <span className="font-bold text-xs uppercase tracking-[0.14em]">
                {option.label}
              </span>
              <span className="font-mono text-[11px] tracking-normal">
                {option.fileName}
              </span>
            </Button>
          )
        })}
      </div>
    </>
  )
}
