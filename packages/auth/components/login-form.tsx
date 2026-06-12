'use client'

import {
  initialLoginFormState,
  loginFormReducer,
} from '@outname/auth/components/login-form-state'
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
import { useEffect, useReducer, useRef } from 'react'
import { toast } from 'sonner'

const OTP_LENGTH = 6
const OTP_SLOT_IDS = ['otp-0', 'otp-1', 'otp-2', 'otp-3', 'otp-4', 'otp-5']
const EMAIL_STORAGE_KEY = 'outname:login-email'

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const { push, refresh } = useRouter()
  const [state, dispatch] = useReducer(loginFormReducer, initialLoginFormState)
  const isVerifyingOtpRef = useRef(false)
  const { email, otp, isRequestingOtp, isVerifyingOtp, step, statusMessage } =
    state

  // Restore the email after an interrupted attempt (refresh, closed tab) so
  // the user does not have to retype it.
  useEffect(() => {
    try {
      const storedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY)
      if (storedEmail) {
        dispatch({ type: 'set_email', value: storedEmail })
      }
    } catch {
      // Storage unavailable (private mode); skip restore.
    }
  }, [])

  async function sendOtpRequest() {
    dispatch({ type: 'set_requesting_otp', value: true })

    try {
      const response = await fetch('/api/auth/request-otp', {
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
        dispatch({ type: 'set_requesting_otp', value: false })
        return
      }

      dispatch({
        type: 'otp_sent',
        message:
          payload?.message ||
          'Check your inbox for the one-time code, then enter it here.',
      })
      toast.success('Sign-in code sent')
    } catch {
      toast.error('Could not send a sign-in code')
      dispatch({ type: 'set_requesting_otp', value: false })
    }
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault()
    await sendOtpRequest()
  }

  async function resendOtp() {
    await sendOtpRequest()
  }

  async function verifyOtpValue(otpValue: string) {
    // Synchronous latch: the reducer flag updates asynchronously, so the OTP
    // auto-submit and a form submit landing in the same tick could both pass
    // an isVerifyingOtp check and verify twice.
    if (isVerifyingOtpRef.current) {
      return
    }
    isVerifyingOtpRef.current = true
    dispatch({ type: 'set_verifying_otp', value: true })

    let error: { message?: string } | null = null
    try {
      const result = await signIn.emailOtp({ email, otp: otpValue })
      error = result.error
    } finally {
      isVerifyingOtpRef.current = false
      dispatch({ type: 'set_verifying_otp', value: false })
    }

    if (error) {
      toast.error(error.message || 'Invalid sign-in code')
      return
    }

    try {
      window.localStorage.removeItem(EMAIL_STORAGE_KEY)
    } catch {
      // Storage unavailable; nothing to clean up.
    }
    toast.success('Signed in')
    push(redirectTo)
    refresh()
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    await verifyOtpValue(otp)
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
            dispatch({ type: 'set_email', value: e.target.value })
            try {
              window.localStorage.setItem(EMAIL_STORAGE_KEY, e.target.value)
            } catch {
              // Storage unavailable; the form still works without persistence.
            }
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
            <Button
              className="h-auto px-0 py-0 text-[11px] text-foreground tracking-[0.14em] underline hover:text-foreground"
              onClick={() => {
                dispatch({ type: 'back_to_request' })
              }}
              size="xs"
              type="button"
              variant="link"
            >
              Change email
            </Button>
          </div>

          <div className="pt-1">
            <InputOTP
              containerClassName="justify-start"
              id="login-otp"
              inputMode="numeric"
              maxLength={OTP_LENGTH}
              onChange={(value) => {
                dispatch({ type: 'set_otp', value })
                if (value.length === OTP_LENGTH) {
                  // Auto-submit once the final digit lands; no extra click.
                  verifyOtpValue(value)
                }
              }}
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
