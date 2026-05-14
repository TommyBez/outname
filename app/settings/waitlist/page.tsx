import type { Metadata } from 'next'
import Link from 'next/link'
import { requireWaitlistManageAccess } from '@/auth/server/auth-guard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AppShell } from '@/shared/components/layout/app-shell'
import type { WaitlistEntry } from '@/shared/db/schema'
import { formatDateTime, formatRelative } from '@/shared/server/format'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'
import {
  resendWaitlistConfirmationAction,
  sendWaitlistInviteAction,
  updateWaitlistStatusAction,
} from '@/waitlist/server/actions'
import { WAITLIST_ENTRY_STATUSES } from '@/waitlist/server/constants'
import {
  listWaitlistEntries,
  listWaitlistFilterValues,
  type WaitlistFilters,
} from '@/waitlist/server/service'

export const metadata: Metadata = createPrivatePageMetadata(
  'Waitlist',
  'Manage waitlist confirmations, invites, and status transitions.'
)

const CREATED_FILTERS = [
  { label: 'Any time', value: '' },
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
] as const

function parseCreatedWithinDays(value?: string): number | undefined {
  if (!value) {
    return
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function buildFilters(params: {
  created?: string
  search?: string
  source?: string
  status?: string
  useCase?: string
}): WaitlistFilters {
  const status = WAITLIST_ENTRY_STATUSES.find(
    (value) => value === params.status
  )

  return {
    createdWithinDays: parseCreatedWithinDays(params.created),
    search: params.search,
    source: params.source || undefined,
    status,
    useCase: params.useCase || undefined,
  }
}

export default async function WaitlistSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string
    search?: string
    source?: string
    status?: string
    useCase?: string
  }>
}) {
  await requireWaitlistManageAccess()
  const params = await searchParams
  const filters = buildFilters(params)

  const [entries, filterValues] = await Promise.all([
    listWaitlistEntries(filters),
    listWaitlistFilterValues(),
  ])

  return (
    <AppShell>
      <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
        <p className="swiss-label mb-4 text-accent">10. Settings / Waitlist</p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-black font-serif text-6xl uppercase leading-[0.9] tracking-tighter md:text-8xl">
              Waitlist
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground text-sm leading-relaxed">
              Review pending signups, resend confirmation emails, and send
              invites when access is ready.
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
            href="/settings"
          >
            Back to settings
          </Link>
        </div>
      </header>

      <section className="border-foreground border-y-2 py-8">
        <form className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))_auto]">
          <label className="flex flex-col gap-2">
            <span className="font-bold text-muted-foreground text-xs uppercase tracking-wider">
              Search email
            </span>
            <input
              className="h-11 border-2 border-foreground bg-background px-3 text-sm"
              defaultValue={params.search ?? ''}
              name="search"
              placeholder="user@example.com"
              type="search"
            />
          </label>

          <FilterSelect
            defaultValue={params.status ?? ''}
            label="Status"
            name="status"
            options={[
              { label: 'All', value: '' },
              ...WAITLIST_ENTRY_STATUSES.map((status) => ({
                label: status,
                value: status,
              })),
            ]}
          />

          <FilterSelect
            defaultValue={params.source ?? ''}
            label="Source"
            name="source"
            options={[
              { label: 'All', value: '' },
              ...filterValues.sources.map((source) => ({
                label: source,
                value: source,
              })),
            ]}
          />

          <FilterSelect
            defaultValue={params.useCase ?? ''}
            label="Use case"
            name="useCase"
            options={[
              { label: 'All', value: '' },
              ...filterValues.useCases.map((useCase) => ({
                label: useCase,
                value: useCase,
              })),
            ]}
          />

          <FilterSelect
            defaultValue={params.created ?? ''}
            label="Created"
            name="created"
            options={CREATED_FILTERS.map((item) => ({
              label: item.label,
              value: item.value,
            }))}
          />

          <div className="flex items-end gap-2">
            <Button
              className="w-full lg:w-auto"
              type="submit"
              variant="outline"
            >
              Filter
            </Button>
          </div>
        </form>
      </section>

      <section className="pt-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Use case</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Confirmation</TableHead>
              <TableHead>Invite</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-muted-foreground" colSpan={8}>
                  No waitlist entries match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <WaitlistTableRow entry={entry} key={entry.id} />
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </AppShell>
  )
}

function FilterSelect({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue: string
  label: string
  name: string
  options: Array<{ label: string; value: string }>
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-bold text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </span>
      <select
        className="h-11 border-2 border-foreground bg-background px-3 text-sm"
        defaultValue={defaultValue}
        name={name}
      >
        {options.map((option) => (
          <option key={`${name}-${option.value || 'all'}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function WaitlistTableRow({ entry }: { entry: WaitlistEntry }) {
  return (
    <TableRow>
      <TableCell className="align-top">
        <div className="space-y-1">
          <p className="font-bold">{entry.email}</p>
          <p className="text-muted-foreground text-xs">
            {entry.name ?? 'No name'}
          </p>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <Badge variant="outline">{entry.status}</Badge>
      </TableCell>
      <TableCell className="max-w-[18rem] whitespace-normal align-top text-sm leading-relaxed">
        {entry.useCase ?? '—'}
      </TableCell>
      <TableCell className="align-top text-sm">{entry.source ?? '—'}</TableCell>
      <TableCell className="align-top text-xs">
        <div>{formatDateTime(entry.createdAt)}</div>
        <div className="text-muted-foreground">
          {formatRelative(entry.createdAt)}
        </div>
      </TableCell>
      <TableCell className="align-top text-xs">
        <div>{formatDateTime(entry.confirmationEmailSentAt)}</div>
        <div className="text-muted-foreground">
          {entry.confirmedAt ? 'Confirmed' : 'Pending'}
        </div>
      </TableCell>
      <TableCell className="align-top text-xs">
        <div>{formatDateTime(entry.inviteEmailSentAt)}</div>
        <div className="text-muted-foreground">
          {entry.invitedAt ? 'Invited' : 'Not sent'}
        </div>
      </TableCell>
      <TableCell className="align-top">
        <WaitlistActionButtons entry={entry} />
      </TableCell>
    </TableRow>
  )
}

function WaitlistActionButtons({ entry }: { entry: WaitlistEntry }) {
  return (
    <div className="flex flex-col gap-2">
      {entry.status === 'pending' ? (
        <form action={resendWaitlistConfirmationAction}>
          <input name="entryId" type="hidden" value={entry.id} />
          <Button size="xs" type="submit" variant="outline">
            Resend confirm
          </Button>
        </form>
      ) : null}

      {entry.status === 'confirmed' || entry.status === 'invited' ? (
        <form action={sendWaitlistInviteAction}>
          <input name="entryId" type="hidden" value={entry.id} />
          <Button size="xs" type="submit">
            Send invite
          </Button>
        </form>
      ) : null}

      {entry.status === 'converted' ? null : (
        <form action={updateWaitlistStatusAction}>
          <input name="entryId" type="hidden" value={entry.id} />
          <input name="status" type="hidden" value="converted" />
          <Button size="xs" type="submit" variant="secondary">
            Mark converted
          </Button>
        </form>
      )}

      {entry.status === 'unsubscribed' ? null : (
        <form action={updateWaitlistStatusAction}>
          <input name="entryId" type="hidden" value={entry.id} />
          <input name="status" type="hidden" value="unsubscribed" />
          <Button size="xs" type="submit" variant="ghost">
            Unsubscribe
          </Button>
        </form>
      )}
    </div>
  )
}
