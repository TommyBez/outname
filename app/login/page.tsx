import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { ensureAdminUser } from "@/lib/bootstrap"
import { LoginForm } from "./login-form"

export const dynamic = "force-dynamic"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  await ensureAdminUser()
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) redirect("/")

  const { from } = await searchParams
  return (
    <main className="min-h-svh grid place-items-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="font-serif text-3xl font-medium leading-tight tracking-tight">
            Inbox Assistant
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to read today&apos;s briefing.
          </p>
        </div>
        <LoginForm redirectTo={from || "/"} />
      </div>
    </main>
  )
}
