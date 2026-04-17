"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth-client"

export function SignOutButton() {
  const router = useRouter()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="ml-2 text-muted-foreground"
      onClick={async () => {
        await signOut()
        router.push("/login")
        router.refresh()
      }}
      aria-label="Sign out"
    >
      <LogOut className="size-4" />
    </Button>
  )
}
