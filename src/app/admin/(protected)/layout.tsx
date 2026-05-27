import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminShell from '@/components/AdminShell'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/admin-auth'

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  const authed = await isValidAdminSession(token)

  if (!authed) {
    redirect('/admin/login')
  }

  return <AdminShell>{children}</AdminShell>
}
