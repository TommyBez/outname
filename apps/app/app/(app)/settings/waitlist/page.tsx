import { requireWaitlistManageAccess } from '@outname/auth/server/auth-guard'
import type { WaitlistEntry } from '@outname/db/schema'
import { formatDateTime, formatRelative } from '@outname/shared/server/format'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { InviteUserForm } from '@outname/shared/waitlist/components/invite-user-form'
import { WaitlistActionButtons } from '@outname/shared/waitlist/components/waitlist-action-buttons'
import {
  WAITLIST_ENTRY_STATUSES,
  WAITLIST_PRIMARY_INTEREST_OPTIONS,
  WAITLIST_PROFILE_TYPE_OPTIONS,
} from '@outname/shared/waitlist/server/constants'
import {
  listWaitlistEntries,
  listWaitlistFilterValues,
  type WaitlistFilters,
} from '@outname/shared/waitlist/server/service'
import { Badge } from '@outname/ui/components/ui/badge'
import { Button } from '@outname/ui/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@outname/ui/components/ui/table'
import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'

export const metadata: Metadata = createPrivatePageMetadata(
  'Waitlist',
  'Manage waitlist confirmations, account provisioning, and access notifications.'
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
  primaryInterest?: string
  profileType?: string
  search?: string
  source?: string
  status?: string
}): WaitlistFilters {
  const status = WAITLIST_ENTRY_STATUSES.find(
    (value) => value === params.status
  )
  const primaryInterest = WAITLIST_PRIMARY_INTEREST_OPTIONS.find(
    (option) => option.value === params.primaryInterest
  )?.value
  const profileType = WAITLIST_PROFILE_TYPE_OPTIONS.find(
    (option) => option.value === params.profileType
  )?.value

  return {
    createdWithinDays: parseCreatedWithinDays(params.created),
    primaryInterest,
    profileType,
    search: params.search,
    source: params.source || undefined,
    status,
  }
}

export default async function WaitlistSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string
    primaryInterest?: string
    profileType?: string
    search?: string
    source?: string
    status?: string
  }>
}) {
  return (
    <Suspense fallback={<WaitlistSettingsFallback />}>
      <WaitlistSettingsContent searchParams={searchParams} />
    </Suspense>
  )
}

async function WaitlistSettingsContent({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string
    primaryInterest?: string
    profileType?: string
    search?: string
    source?: string
    status?: string
  }>
}) {
  const [, params] = await Promise.all([connection(), searchParams])

  const filters = buildFilters(params)
  const [entries, filterValues] = await requireWaitlistManageAccess().then(() =>
    Promise.all([listWaitlistEntries(filters), listWaitlistFilterValues()])
  )

  return (
    <>
      <header className="mb-12 border-border border-t pt-6 md:mb-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-semibold text-3xl tracking-tight">Waitlist</h1>
            <p className="mt-4 max-w-2xl text-muted-foreground text-sm leading-relaxed">
              Invite someone directly, review pending signups, provision
              accounts when access is ready, and resend confirmation or access
              emails.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/settings">Back to settings</Link>
          </Button>
        </div>
      </header>

      <section className="border-border border-y py-8">
        <div className="mb-8">
          <p className="swiss-label mb-4 text-brand">Invite user</p>
          <p className="mb-4 max-w-2xl text-muted-foreground text-sm leading-relaxed">
            Send a product introduction and sign-in link to any email address.
            The account is provisioned immediately; no waitlist confirmation is
            required.
          </p>
          <InviteUserForm />
        </div>

        <form className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(5,minmax(0,1fr))_auto]">
          <label className="flex flex-col gap-2">
            <span className="font-bold text-muted-foreground text-xs tracking-wider">
              Search email
            </span>
            <input
              aria-label="Search waitlist email"
              className="h-11 border border-border bg-background px-3 text-sm"
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
            defaultValue={params.primaryInterest ?? ''}
            label="Interest"
            name="primaryInterest"
            options={[
              { label: 'All', value: '' },
              ...WAITLIST_PRIMARY_INTEREST_OPTIONS,
            ]}
          />

          <FilterSelect
            defaultValue={params.profileType ?? ''}
            label="Profile"
            name="profileType"
            options={[
              { label: 'All', value: '' },
              ...WAITLIST_PROFILE_TYPE_OPTIONS,
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
              <TableHead>Interest</TableHead>
              <TableHead>Profile</TableHead>
              <TableHead>Use case</TableHead>
              <TableHead>Attribution</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Confirmation</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-muted-foreground" colSpan={10}>
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
    </>
  )
}

function WaitlistSettingsFallback() {
  return (
    <output
      aria-busy="true"
      className="border-border border-t pt-6 text-muted-foreground text-sm"
    >
      Loading waitlist manager…
    </output>
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
      <span className="font-bold text-muted-foreground text-xs tracking-wider">
        {label}
      </span>
      <select
        className="h-11 border border-border bg-background px-3 text-sm"
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
  let accessState = 'Not provisioned'
  if (entry.provisionedAt) {
    accessState = 'Provisioned'
  } else if (entry.invitedAt) {
    accessState = 'Access emailed'
  }

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
      <TableCell className="align-top text-sm">
        {getOptionLabel(
          WAITLIST_PRIMARY_INTEREST_OPTIONS,
          entry.primaryInterest
        )}
      </TableCell>
      <TableCell className="align-top text-sm">
        {getOptionLabel(WAITLIST_PROFILE_TYPE_OPTIONS, entry.profileType)}
      </TableCell>
      <TableCell className="max-w-[18rem] whitespace-normal align-top text-sm leading-relaxed">
        {entry.useCase ?? '—'}
      </TableCell>
      <TableCell className="align-top text-xs">
        <AttributionLine label="Source" value={entry.source} />
        <AttributionLine label="UTM source" value={entry.utmSource} />
        <AttributionLine label="Medium" value={entry.utmMedium} />
        <AttributionLine label="Campaign" value={entry.utmCampaign} />
        <AttributionLine label="Content" value={entry.utmContent} />
      </TableCell>
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
        <div>
          {formatDateTime(entry.provisionedAt ?? entry.inviteEmailSentAt)}
        </div>
        <div className="text-muted-foreground">{accessState}</div>
      </TableCell>
      <TableCell className="align-top">
        <WaitlistActionButtons entry={entry} />
      </TableCell>
    </TableRow>
  )
}

function getOptionLabel(
  options: readonly { label: string; value: string }[],
  value?: string | null
) {
  if (!value) {
    return '—'
  }
  return options.find((option) => option.value === value)?.label ?? value
}

function AttributionLine({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div className="max-w-[12rem] truncate">
      <span className="text-muted-foreground">{label}: </span>
      {value ?? '—'}
    </div>
  )
}
