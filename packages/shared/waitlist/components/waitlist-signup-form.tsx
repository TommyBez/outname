'use client'

import {
  WAITLIST_GENERIC_SUCCESS_MESSAGE,
  WAITLIST_PRIMARY_INTEREST_OPTIONS,
  WAITLIST_PROFILE_TYPE_OPTIONS,
  type WaitlistPrimaryInterest,
  type WaitlistProfileType,
} from '@outname/shared/waitlist/server/constants'
import { Button } from '@outname/ui/components/ui/button'
import { Input } from '@outname/ui/components/ui/input'
import { Label } from '@outname/ui/components/ui/label'
import { Spinner } from '@outname/ui/components/ui/spinner'
import { Textarea } from '@outname/ui/components/ui/textarea'
import { useReducer } from 'react'
import {
  initialWaitlistSignupFormState,
  waitlistSignupFormReducer,
} from './waitlist-signup-form-state'

interface WaitlistSignupFormProps {
  initialSource: string
  utmCampaign?: string
  utmContent?: string
  utmMedium?: string
  utmSource?: string
}

export function WaitlistSignupForm({
  initialSource,
  utmCampaign,
  utmContent,
  utmMedium,
  utmSource,
}: WaitlistSignupFormProps) {
  const [state, dispatch] = useReducer(
    waitlistSignupFormReducer,
    initialWaitlistSignupFormState
  )

  const referrer = typeof document === 'undefined' ? '' : document.referrer

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({ type: 'set_is_submitting', value: true })

    try {
      const response = await fetch('/api/waitlist', {
        credentials: 'include',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: state.email,
          name: state.name,
          primaryInterest: state.primaryInterest || null,
          profileType: state.profileType || null,
          useCase: state.useCase,
          source: initialSource,
          referrer,
          utmCampaign,
          utmContent,
          utmMedium,
          utmSource,
          company: state.company,
        }),
      })

      if (response.status === 404) {
        dispatch({
          type: 'set_submitted_message',
          value: 'Waitlist submissions are currently unavailable.',
        })
        return
      }

      if (!response.ok) {
        dispatch({
          type: 'set_submitted_message',
          value: 'Something went wrong. Please try again shortly.',
        })
        return
      }

      const payload = (await response.json()) as { message?: string }
      dispatch({
        type: 'set_submitted_message',
        value: payload.message ?? WAITLIST_GENERIC_SUCCESS_MESSAGE,
      })
    } catch {
      dispatch({
        type: 'set_submitted_message',
        value: 'Something went wrong. Please try again shortly.',
      })
    } finally {
      dispatch({ type: 'set_is_submitting', value: false })
    }
  }

  if (state.submittedMessage) {
    return (
      <div className="border-2 border-foreground bg-accent p-6">
        <p className="swiss-label text-foreground">Request received</p>
        <p className="mt-3 text-sm leading-relaxed">{state.submittedMessage}</p>
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
          onChange={(event) =>
            dispatch({ type: 'set_email', value: event.target.value })
          }
          required
          type="email"
          value={state.email}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-muted-foreground" htmlFor="waitlist-name">
          Name
        </Label>
        <Input
          autoComplete="name"
          id="waitlist-name"
          onChange={(event) =>
            dispatch({ type: 'set_name', value: event.target.value })
          }
          placeholder="Optional"
          value={state.name}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label
          className="text-muted-foreground"
          htmlFor="waitlist-primary-interest"
        >
          What are you here for?
        </Label>
        <select
          className="h-11 border-2 border-foreground bg-background px-3 text-sm"
          id="waitlist-primary-interest"
          onChange={(event) =>
            dispatch({
              type: 'set_primary_interest',
              value: event.target.value as WaitlistPrimaryInterest,
            })
          }
          required
          value={state.primaryInterest}
        >
          <option value="">Select one</option>
          {WAITLIST_PRIMARY_INTEREST_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-muted-foreground" htmlFor="waitlist-profile">
          Which describes you best?
        </Label>
        <select
          className="h-11 border-2 border-foreground bg-background px-3 text-sm"
          id="waitlist-profile"
          onChange={(event) =>
            dispatch({
              type: 'set_profile_type',
              value: event.target.value as WaitlistProfileType,
            })
          }
          required
          value={state.profileType}
        >
          <option value="">Select one</option>
          {WAITLIST_PROFILE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-muted-foreground" htmlFor="waitlist-use-case">
          Use case
        </Label>
        <Textarea
          id="waitlist-use-case"
          onChange={(event) =>
            dispatch({ type: 'set_use_case', value: event.target.value })
          }
          placeholder="Optional: what would you use OUTNA.ME for?"
          rows={4}
          value={state.useCase}
        />
      </div>

      <div aria-hidden className="absolute top-auto -left-[9999px]">
        <Label htmlFor="company">Company</Label>
        <Input
          autoComplete="organization"
          id="company"
          onChange={(event) =>
            dispatch({ type: 'set_company', value: event.target.value })
          }
          tabIndex={-1}
          value={state.company}
        />
      </div>

      <Button className="mt-2" disabled={state.isSubmitting} type="submit">
        {state.isSubmitting ? (
          <Spinner className="size-4" />
        ) : (
          'Join the waitlist'
        )}
      </Button>
    </form>
  )
}
