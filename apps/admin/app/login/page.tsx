import { redirect } from 'next/navigation'

export default function AdminLoginPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  redirect(`${appUrl}/login?from=/waitlist`)
}
