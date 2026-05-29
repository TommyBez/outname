'use client'

import { signIn } from '@outname/auth/server/auth-client'
import { Button } from '@outname/ui/components/ui/button'
import { Input } from '@outname/ui/components/ui/input'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@outname/ui/components/ui/input-otp'
import { Label } from '@outname/ui/components/ui/label'
import { Spinner } from '@outname/ui/components/ui/spinner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

const OTP_LENGTH = 6
const OTP_SLOT_IDS = ['otp-0', 'otp-1', 'otp-2', 'otp-3', 'otp-4', 'otp-5']
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const { push, refresh } = useRouter()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [isRequestingOtp, setIsRequestingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  async function sendOtpRequest() {
    setIsRequestingOtp(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/request-otp`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email,
        }),
      })

      const payload = (await response.json().catch(() => null)) as {
        error?: string
        message?: string
      } | null

      if (!response.ok) {
        toast.error(payload?.error || 'Could not send a sign-in code')
        return
      }

      setStatusMessage(
        payload?.message ||
          'Check your inbox for the one-time code, then enter it here.'
      )
      setStep('verify')
      setOtp('')
      toast.success('Sign-in code sent')
    } catch {
      toast.error('Could not send a sign-in code')
    } finally {
      setIsRequestingOtp(false)
    }
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault()
    await sendOtpRequest()
  }

  async function resendOtp() {
    await sendOtpRequest()
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setIsVerifyingOtp(true)

    const { error } = await signIn.emailOtp({ email, otp })
    setIsVerifyingOtp(false)

    if (error) {
      toast.error(error.message || 'Invalid sign-in code')
      return
    }

    toast.success('Signed in')
    push(redirectTo)
    refresh()
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={step === 'request' ? requestOtp : verifyOtp}
    >
      <div className="flex flex-col gap-2">
        <Label className="text-muted-foreground" htmlFor="login-email">
          Email
        </Label>
        <Input
          autoComplete="email"
          disabled={isRequestingOtp || isVerifyingOtp || step === 'verify'}
          id="login-email"
          onChange={(e) => {
            setEmail(e.target.value)
            setStatusMessage(null)
          }}
          required
          type="email"
          value={email}
        />
      </div>

      {step === 'verify' ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-muted-foreground" htmlFor="login-otp">
                One-time code
              </Label>
              <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                {statusMessage ??
                  'Enter the 6-digit code from your email to continue.'}
              </p>
            </div>
            <button
              className="font-bold text-[11px] text-foreground uppercase tracking-[0.14em] underline underline-offset-4"
              onClick={() => {
                setStep('request')
                setOtp('')
                setStatusMessage(null)
              }}
              type="button"
            >
              Change email
            </button>
          </div>

          <div className="pt-1">
            <InputOTP
              containerClassName="justify-start"
              id="login-otp"
              inputMode="numeric"
              maxLength={OTP_LENGTH}
              onChange={setOtp}
              pattern="[0-9]*"
              value={otp}
            >
              <InputOTPGroup>
                {OTP_SLOT_IDS.map((slotId, index) => (
                  <InputOTPSlot index={index} key={slotId} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              className="mt-1"
              disabled={isVerifyingOtp || otp.length !== OTP_LENGTH}
              type="submit"
            >
              {isVerifyingOtp ? <Spinner className="size-4" /> : 'Sign in'}
            </Button>
            <Button
              disabled={isRequestingOtp || isVerifyingOtp}
              onClick={resendOtp}
              type="button"
              variant="outline"
            >
              {isRequestingOtp ? (
                <Spinner className="size-4" />
              ) : (
                'Send a new code'
              )}
            </Button>
          </div>
        </div>
      ) : (
        <Button className="mt-2" disabled={isRequestingOtp} type="submit">
          {isRequestingOtp ? <Spinner className="size-4" /> : 'Email me a code'}
        </Button>
      )}
    </form>
  )
}
