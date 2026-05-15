'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { WAITLIST_GENERIC_SUCCESS_MESSAGE } from '@/waitlist/server/constants'

interface WaitlistSignupFormProps {
  initialSource: string
  utmCampaign?: string
  utmMedium?: string
  utmSource?: string
}

export function WaitlistSignupForm({
  initialSource,
  utmCampaign,
  utmMedium,
  utmSource,
}: WaitlistSignupFormProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [useCase, setUseCase] = useState('')
  const [company, setCompany] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null)

  const referrer = useMemo(
    () => (typeof document === 'undefined' ? '' : document.referrer),
    []
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          useCase,
          source: initialSource,
          referrer,
          utmCampaign,
          utmMedium,
          utmSource,
          company,
        }),
      })

      if (response.status === 404) {
        setSubmittedMessage('Waitlist submissions are currently unavailable.')
        return
      }

      if (!response.ok) {
        setSubmittedMessage('Something went wrong. Please try again shortly.')
        return
      }

      const payload = (await response.json()) as { message?: string }
      setSubmittedMessage(payload.message ?? WAITLIST_GENERIC_SUCCESS_MESSAGE)
    } catch {
      setSubmittedMessage('Something went wrong. Please try again shortly.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedMessage) {
    return (
      <div className="border-2 border-foreground bg-accent p-6">
        <p className="swiss-label text-foreground">Request received</p>
        <p className="mt-3 text-sm leading-relaxed">{submittedMessage}</p>
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label className="text-muted-foreground" htmlFor="waitlist-email">
          Email
        </Label>
        <Input
          autoComplete="email"
          id="waitlist-email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-muted-foreground" htmlFor="waitlist-name">
          Name
        </Label>
        <Input
          autoComplete="name"
          id="waitlist-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Optional"
          value={name}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-muted-foreground" htmlFor="waitlist-use-case">
          Use case
        </Label>
        <Textarea
          id="waitlist-use-case"
          onChange={(event) => setUseCase(event.target.value)}
          placeholder="What would you use OUTNA.ME for?"
          rows={4}
          value={useCase}
        />
      </div>

      <div aria-hidden className="absolute top-auto -left-[9999px]">
        <Label htmlFor="company">Company</Label>
        <Input
          autoComplete="organization"
          id="company"
          onChange={(event) => setCompany(event.target.value)}
          tabIndex={-1}
          value={company}
        />
      </div>

      <Button className="mt-2" disabled={isSubmitting} type="submit">
        {isSubmitting ? <Spinner className="size-4" /> : 'Join the waitlist'}
      </Button>
    </form>
  )
}
