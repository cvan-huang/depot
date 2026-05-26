export const ADMIN_SESSION_COOKIE = 'depot_admin_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7

const SESSION_PAYLOAD = 'depot-admin-session-v1'
const LOCAL_DEV_PASSWORD = 'admin'

export function getAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD
  if (process.env.NODE_ENV !== 'production') return LOCAL_DEV_PASSWORD
  return null
}

export function isUsingLocalDevPassword() {
  return !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== 'production'
}

export function isAdminAuthConfigured() {
  return Boolean(getAdminPassword())
}

function getSessionSecret() {
  const password = getAdminPassword()
  if (!password) return null
  return `${process.env.ADMIN_SESSION_SECRET || 'depot-session'}:${password}`
}

async function sign(value: string) {
  const secret = getSessionSecret()
  if (!secret) return null

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function createAdminSessionToken() {
  return sign(SESSION_PAYLOAD)
}

export async function isValidAdminSession(token?: string) {
  if (!token) return false
  const expected = await createAdminSessionToken()
  return Boolean(expected && token === expected)
}

export function verifyAdminPassword(password: string) {
  const expected = getAdminPassword()
  return Boolean(expected && password === expected)
}

export function getAdminCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  }
}
