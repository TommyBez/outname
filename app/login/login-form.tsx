"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { signIn } from "@/lib/auth-client"

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    const { error } = await signIn.email({ email, password })
    setIsLoading(false)
    if (error) {
      toast.error(error.message || "Invalid credentials")
      return
    }
    toast.success("Signed in")
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="email"
          className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground"
        >
          Email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="password"
          className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground"
        >
          Password
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={isLoading} className="mt-2">
        {isLoading ? <Spinner className="size-4" /> : "Sign in"}
      </Button>
    </form>
  )
}
