import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminCookieOptions,
  isAdminAuthConfigured,
  verifyAdminPassword,
} from '@/lib/admin-auth'

function getSafeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : ''
  if (!next || !next.startsWith('/admin') || next.startsWith('/admin/login')) {
    return '/admin'
  }
  return next
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const password = String(formData.get('password') || '')
  const next = getSafeNext(formData.get('next'))

  if (!isAdminAuthConfigured()) {
    return NextResponse.redirect(new URL('/admin/login?error=config', request.url), 303)
  }

  if (!verifyAdminPassword(password)) {
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('error', '1')
    loginUrl.searchParams.set('next', next)
    return NextResponse.redirect(loginUrl, 303)
  }

  const token = await createAdminSessionToken()
  const response = NextResponse.redirect(new URL(next, request.url), 303)
  if (token) {
    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      token,
      getAdminCookieOptions(request.nextUrl.protocol === 'https:')
    )
  }
  return response
}
