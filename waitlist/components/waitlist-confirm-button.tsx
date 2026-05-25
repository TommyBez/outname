'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const HTTP_STATUS_FORBIDDEN = 403

export function WaitlistConfirmButton({ token }: { token: string }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleConfirm: () => Promise<void> = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const formData = new FormData()
      formData.set('token', token)

      const response = await fetch('/api/waitlist/confirm', {
        method: 'POST',
        body: formData,
      })

      if (response.status === HTTP_STATUS_FORBIDDEN) {
        setErrorMessage('Access denied. Please refresh the page and try again.')
        return
      }

      const resultUrl = new URL(response.url)
      if (resultUrl.searchParams.get('status') === 'confirmed') {
        router.push(`${resultUrl.pathname}${resultUrl.search}`)
        router.refresh()
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
