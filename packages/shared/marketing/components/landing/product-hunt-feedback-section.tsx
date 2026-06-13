'use client'

import { Button } from '@outname/ui/components/ui/button'
import { Input } from '@outname/ui/components/ui/input'
import { Label } from '@outname/ui/components/ui/label'
import { Textarea } from '@outname/ui/components/ui/textarea'
import { cn } from '@outname/ui/lib/utils'
import { SendIcon } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'

type FeedbackStatus = 'error' | 'idle' | 'success'

const feedbackTypes = [
  { label: 'Positioning', value: 'positioning' },
  { label: 'First agent', value: 'first-agent' },
  { label: 'Vercel stack', value: 'vercel-stack' },
  { label: 'Trust', value: 'trust' },
  { label: 'Other', value: 'other' },
] as const

type FeedbackType = (typeof feedbackTypes)[number]['value']

function getUtmValue(
  searchParams: URLSearchParams,
  key: string
): string | null {
  const value = searchParams.get(key)?.trim()
  return value ? value : null
}

export function ProductHuntFeedbackSection() {
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('positioning')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<FeedbackStatus>('idle')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const metadata = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        referrer: null,
        utmCampaign: null,
        utmContent: null,
        utmMedium: null,
        utmSource: null,
      }
    }

    const searchParams = new URLSearchParams(window.location.search)
    return {
      referrer: document.referrer || null,
      utmCampaign: getUtmValue(searchParams, 'utm_campaign'),
      utmContent: getUtmValue(searchParams, 'utm_content'),
      utmMedium: getUtmValue(searchParams, 'utm_medium'),
      utmSource: getUtmValue(searchParams, 'utm_source'),
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('idle')
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/launch/product-hunt-feedback', {
        body: JSON.stringify({
          ...metadata,
          company,
          email,
          feedbackType,
          message,
          source: 'product-hunt-landing',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })

      if (!response.ok) {
        setStatus('error')
        return
      }

      setEmail('')
      setMessage('')
      setStatus('success')
    } catch {
      setStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section
      aria-labelledby="product-hunt-feedback-title"
      className="px-4 py-16 sm:px-6 md:px-10 md:py-20 lg:px-12"
      id="launch-feedback"
    >
      <div className="mx-auto grid max-w-7xl gap-8 border-foreground border-t-4 pt-5 md:grid-cols-[minmax(0,0.82fr)_minmax(320px,0.58fr)]">
        <div className="min-w-0">
          <p className="swiss-label text-accent">Product Hunt feedback</p>
          <h2
            className="mt-4 text-balance font-black text-5xl uppercase leading-[0.88] tracking-normal md:text-7xl"
            id="product-hunt-feedback-title"
          >
            Leave the useful criticism here.
          </h2>
          <p className="mt-5 max-w-2xl text-muted-foreground leading-relaxed">
            If the Product Hunt thread is unavailable, this captures the same
            practical feedback: what is clear, what is missing, and what first
            agent would be narrow enough to trust.
          </p>
        </div>

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div aria-hidden className="hidden">
            <Label htmlFor="launch-feedback-company">Company</Label>
            <Input
              autoComplete="organization"
              id="launch-feedback-company"
              name="company"
              onChange={(event) => setCompany(event.target.value)}
              tabIndex={-1}
              value={company}
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-muted-foreground" htmlFor="launch-feedback">
              Feedback
            </Label>
            <Textarea
              className="min-h-36 resize-none border-2 border-foreground bg-background text-base"
              id="launch-feedback"
              maxLength={2000}
              minLength={20}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What is confusing, missing, or not credible yet?"
              required
              value={message}
            />
          </div>

          <div className="grid gap-3">
            <Label className="text-muted-foreground">Feedback type</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {feedbackTypes.map((item) => (
                <button
                  aria-pressed={feedbackType === item.value}
                  className={cn(
                    'min-h-11 border-2 border-foreground px-3 py-2 font-black text-[11px] uppercase tracking-normal transition-colors',
                    feedbackType === item.value
                      ? 'bg-foreground text-background'
                      : 'bg-background text-foreground hover:bg-accent'
                  )}
                  key={item.value}
                  onClick={() => setFeedbackType(item.value)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label
              className="text-muted-foreground"
              htmlFor="launch-feedback-email"
            >
              Email optional
            </Label>
            <Input
              className="h-12 border-2 border-foreground bg-background"
              id="launch-feedback-email"
              maxLength={255}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </div>

          <Button
            className="min-h-14 w-full"
            disabled={isSubmitting}
            type="submit"
          >
            <SendIcon className="size-4" />
            {isSubmitting ? 'Sending feedback' : 'Send feedback'}
          </Button>

          {status === 'success' ? (
            <p className="m-0 border-2 border-foreground bg-accent px-3 py-2 font-bold text-sm">
              Feedback received.
            </p>
          ) : null}
          {status === 'error' ? (
            <p className="m-0 border-2 border-foreground px-3 py-2 font-bold text-destructive text-sm">
              Feedback could not be sent. Please try again.
            </p>
          ) : null}
        </form>
      </div>
    </section>
  )
}
