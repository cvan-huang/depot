'use client'

import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()
  // Header is now part of each page's layout for the public site
  // Admin uses its own layout
  if (pathname.startsWith('/admin') || pathname === '/' || pathname.startsWith('/gallery') || pathname.startsWith('/material')) {
    return null
  }
  return null
}
