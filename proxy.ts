import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/admin-auth'

function isAdminApi(pathname: string) {
  return pathname === '/api/upload' || pathname === '/api/analyze-image'
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  const authed = await isValidAdminSession(token)

  if (pathname === '/admin/login') {
    if (!authed) return NextResponse.next()
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  if (isAdminApi(pathname)) {
    if (authed) return NextResponse.next()
    return NextResponse.json({ error: '请先登录后台' }, { status: 401 })
  }

  if (pathname.startsWith('/admin') && !authed) {
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/upload', '/api/analyze-image'],
}
