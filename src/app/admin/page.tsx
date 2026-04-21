import Link from 'next/link'
import { MOCK_MATERIALS, MOCK_TAGS } from '@/lib/mock-data'

export default function AdminDashboard() {
  const total = MOCK_MATERIALS.length
  const featured = MOCK_MATERIALS.filter(m => m.is_featured).length
  const tagCount = MOCK_TAGS.length

  const stats = [
    { label: 'TOTAL MATERIALS', value: total },
    { label: 'EDITOR PICKS', value: featured },
    { label: 'TOTAL TAGS', value: tagCount },
  ]

  return (
    <div>
      {/* Header */}
      <div className="border-bottom-heavy px-6 py-4">
        <h1 className="heading-display text-3xl">OVERVIEW</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 border-bottom-heavy">
        {stats.map((stat, i) => (
          <div key={stat.label} className={`p-6 ${i < 2 ? 'border-right-heavy' : ''}`}>
            <p className="heading-display text-5xl text-black mb-2">{stat.value}</p>
            <p className="nav-label text-[10px] text-[#808080]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 border-bottom-heavy">
        <Link href="/admin/upload" className="border-right-heavy p-6 group hover:bg-black transition-colors">
          <p className="heading-display text-2xl group-hover:text-white mb-2">UPLOAD</p>
          <p className="nav-label text-[10px] text-[#808080] group-hover:text-[#808080]">ADD NEW REFERENCE →</p>
        </Link>
        <Link href="/admin/manage" className="p-6 group hover:bg-black transition-colors">
          <p className="heading-display text-2xl group-hover:text-white mb-2">MANAGE</p>
          <p className="nav-label text-[10px] text-[#808080] group-hover:text-[#808080]">EDIT & DELETE →</p>
        </Link>
      </div>

      {/* Recent table */}
      <div className="border-bottom-heavy px-6 py-3">
        <span className="heading-display text-lg">RECENT MATERIALS</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-bottom-heavy bg-[#F0F0F0]">
            <th className="text-left nav-label text-[9px] text-[#808080] px-4 py-2 border-right-heavy">TITLE</th>
            <th className="text-left nav-label text-[9px] text-[#808080] px-4 py-2 border-right-heavy">TAGS</th>
            <th className="text-left nav-label text-[9px] text-[#808080] px-4 py-2 border-right-heavy">STATUS</th>
            <th className="text-left nav-label text-[9px] text-[#808080] px-4 py-2">DATE</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_MATERIALS.slice(0, 10).map((m, i) => (
            <tr key={m.id} className={`border-bottom-heavy hover:bg-[#F0F0F0] transition-colors ${i % 2 === 0 ? '' : 'bg-[#FAFAFA]'}`}>
              <td className="px-4 py-2.5 font-bold border-right-heavy">{m.title}</td>
              <td className="px-4 py-2.5 border-right-heavy">
                <div className="flex gap-1 flex-wrap">
                  {m.tags.slice(0, 2).map(t => (
                    <span
                      key={t.id}
                      className="nav-label text-[8px] px-1.5 py-0.5 border"
                      style={{ borderColor: t.color, color: t.color }}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-2.5 border-right-heavy">
                {m.is_featured
                  ? <span className="nav-label text-[9px] bg-[#FF2442] text-white px-2 py-0.5">PICK</span>
                  : <span className="nav-label text-[9px] border border-[#808080] text-[#808080] px-2 py-0.5">STD</span>
                }
              </td>
              <td className="px-4 py-2.5 nav-label text-[9px] text-[#808080]">
                {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
