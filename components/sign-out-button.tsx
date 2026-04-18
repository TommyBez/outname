"use client"

import { useRouter } from "next/navigation"
import { signOut } from "@/lib/auth-client"

export function SignOutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut()
        router.push("/login")
        router.refresh()
      }}
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      Sign out
    </button>
  )
}
