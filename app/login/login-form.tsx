'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { signIn } from '@/lib/auth-client'

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    const { error } = await signIn.email({ email, password })
    setIsLoading(false)
    if (error) {
      toast.error(error.message || 'Invalid credentials')
      return
    }
    toast.success('Signed in')
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label
          className="font-mono text-muted-foreground text-xs uppercase tracking-[0.15em]"
          htmlFor="email"
        >
          Email
        </Label>
        <Input
          autoComplete="email"
          id="email"
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
          value={email}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label
          className="font-mono text-muted-foreground text-xs uppercase tracking-[0.15em]"
          htmlFor="password"
        >
          Password
        </Label>
        <Input
          autoComplete="current-password"
          id="password"
          onChange={(e) => setPassword(e.target.value)}
          required
          type="password"
          value={password}
        />
      </div>
      <Button className="mt-2" disabled={isLoading} type="submit">
        {isLoading ? <Spinner className="size-4" /> : 'Sign in'}
      </Button>
    </form>
  )
}
