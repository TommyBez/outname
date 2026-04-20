import { Suspense } from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { ensureAdminUser } from "@/lib/bootstrap"
import { LoginForm } from "./login-form"

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  return (
    <main className="min-h-svh grid place-items-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            ▪ agents
          </p>
          <h1 className="mt-3 font-mono text-2xl font-medium leading-tight tracking-tight">
            Sign in.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Access your scheduled agents and today&apos;s run.
          </p>
        </div>
        <Suspense fallback={<LoginForm redirectTo="/" />}>
          <LoginGate searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}

async function LoginGate({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  await ensureAdminUser()
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) redirect("/")
  const { from } = await searchParams
  return <LoginForm redirectTo={from || "/"} />
}
