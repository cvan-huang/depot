import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <aside className="w-48 border-right-heavy flex flex-col shrink-0">
        <div className="border-bottom-heavy p-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-5 h-5 bg-[#FF2442] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="0.5" y="0.5" width="3.5" height="3.5" fill="white" />
                <rect x="6" y="0.5" width="3.5" height="3.5" fill="white" opacity="0.7" />
                <rect x="0.5" y="6" width="3.5" height="3.5" fill="white" opacity="0.7" />
                <rect x="6" y="6" width="3.5" height="3.5" fill="white" opacity="0.4" />
              </svg>
            </div>
            <div>
              <p className="nav-label text-xs">MOODBOARD</p>
              <p className="nav-label text-[9px] text-[#808080]">ADMIN</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 flex flex-col">
          <SidebarLink href="/admin" label="OVERVIEW" />
          <SidebarLink href="/admin/upload" label="UPLOAD" />
          <SidebarLink href="/admin/manage" label="MANAGE" />
        </nav>

        <div className="border-top-heavy">
          <Link
            href="/"
            className="flex items-center px-4 py-3 nav-label text-[10px] text-[#808080] hover:bg-black hover:text-white transition-colors border-bottom-heavy"
          >
            ← FRONT END
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="border-bottom-heavy px-4 py-3 nav-label text-[10px] hover:bg-black hover:text-white transition-colors"
    >
      {label}
    </Link>
  )
}
