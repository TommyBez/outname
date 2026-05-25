'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export function WaitlistConfirmButton({ token }: { token: string }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleConfirm() {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const formData = new FormData()
      formData.set('token', token)

      const response = await fetch('/api/waitlist/confirm', {
        method: 'POST',
        body: formData,
        redirect: 'manual',
      })

      if (response.status === 303 || response.status === 302) {
        const location = response.headers.get('Location')
        if (location) {
          router.push(location)
          router.refresh()
          return
        }
      }

      if (response.status === 403) {
        setErrorMessage('Access denied. Please refresh the page and try again.')
        return
      }

      setErrorMessage('Could not confirm your email. Please try again.')
    } catch {
      setErrorMessage('Could not confirm your email. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button disabled={isSubmitting} onClick={handleConfirm} type="button">
        {isSubmitting ? (
          <Spinner className="size-4" />
        ) : (
          'Confirm waitlist request'
        )}
      </Button>
      {errorMessage ? (
        <p className="text-destructive text-sm leading-relaxed">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
