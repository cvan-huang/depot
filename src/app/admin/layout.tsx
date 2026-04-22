'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const font = '"Helvetica Neue", "PingFang SC", Arial, sans-serif'

const NAV = [
  { href: '/admin/upload', label: 'UPLOAD' },
  { href: '/admin/manage', label: 'MANAGE' },
  { href: '/admin', label: 'OVERVIEW', exact: true },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: font }}>
      {/* Header */}
      <header style={{ padding: '36px 48px 0', borderBottom: '1px solid #e8e8e8' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>

          {/* Title */}
          <Link href="/admin" style={{ textDecoration: 'none' }}>
            <h1 style={{
              fontSize: 'clamp(28px, 4vw, 52px)',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: '#111',
              fontFamily: font,
            }}>
              DEPOT
            </h1>
          </Link>

          {/* Nav tabs */}
          <nav style={{ display: 'flex', alignItems: 'flex-end', gap: '0' }}>
            {NAV.map(item => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: '10px 20px 12px',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#111' : '#BDBDBD',
                    textDecoration: 'none',
                    fontFamily: font,
                    letterSpacing: '0.05em',
                    borderBottom: isActive ? '2px solid #111' : '2px solid transparent',
                    transition: 'color 0.15s',
                  }}
                >
                  {item.label}
                </Link>
              )
            })}
            <Link
              href="/"
              style={{
                padding: '10px 20px 12px',
                fontSize: '12px',
                fontWeight: 400,
                color: '#BDBDBD',
                textDecoration: 'none',
                fontFamily: font,
                letterSpacing: '0.05em',
                borderBottom: '2px solid transparent',
                transition: 'color 0.15s',
              }}
            >
              BACK TO LIBRARY
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main>
        {children}
      </main>
    </div>
  )
}
