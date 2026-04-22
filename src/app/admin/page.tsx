'use client'

import { useEffect, useState } from 'react'
import { MaterialWithTags } from '@/types'

const font = '"Helvetica Neue", "PingFang SC", Arial, sans-serif'

interface ActivityGroup {
  author: string
  count: number
  date: string
  time: string
  materials: MaterialWithTags[]
}

function groupByAuthorAndDay(materials: MaterialWithTags[]): ActivityGroup[] {
  const map = new Map<string, MaterialWithTags[]>()

  for (const m of materials) {
    const author = (m as any).author || '未署名'
    const date = new Date(m.created_at)
    const dateKey = date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const key = `${author}__${dateKey}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  }

  return Array.from(map.entries()).map(([key, items]) => {
    const [author] = key.split('__')
    const sorted = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const latest = new Date(sorted[0].created_at)
    return {
      author,
      count: items.length,
      date: latest.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }),
      time: latest.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      materials: sorted,
    }
  }).sort((a, b) => {
    const aTime = new Date(a.materials[0].created_at).getTime()
    const bTime = new Date(b.materials[0].created_at).getTime()
    return bTime - aTime
  })
}

export default function AdminDashboard() {
  const [materials, setMaterials] = useState<MaterialWithTags[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('@/lib/supabase/queries').then(({ getMaterials }) => {
      getMaterials().then(data => {
        setMaterials(data)
        setLoading(false)
      })
    })
  }, [])

  const activities = groupByAuthorAndDay(materials)

  return (
    <div style={{ fontFamily: font, padding: '32px 48px 80px' }}>

      {/* Title + total */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '48px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', color: '#111' }}>
          Overview
        </h2>
        {!loading && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.03em', color: '#111' }}>
              {materials.length}
            </span>
            <span style={{ fontSize: '13px', color: '#BDBDBD' }}>张素材</span>
          </div>
        )}
      </div>

      {/* Activity log */}
      <div>
        <p style={{ fontSize: '11px', color: '#BDBDBD', marginBottom: '20px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          上传记录
        </p>

        {loading && (
          <p style={{ fontSize: '13px', color: '#BDBDBD', padding: '40px 0' }}>加载中...</p>
        )}

        {!loading && activities.length === 0 && (
          <p style={{ fontSize: '13px', color: '#BDBDBD', padding: '40px 0' }}>暂无上传记录</p>
        )}

        {!loading && activities.map((group, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr 120px',
              gap: '24px',
              alignItems: 'start',
              padding: '20px 0',
              borderBottom: '1px solid #F0F0F0',
            }}
          >
            {/* Who */}
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111' }}>{group.author}</p>
              <p style={{ fontSize: '11px', color: '#BDBDBD', marginTop: '3px' }}>
                上传了 {group.count} 张
              </p>
            </div>

            {/* Preview thumbnails */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {group.materials.slice(0, 8).map(m => (
                <div
                  key={m.id}
                  style={{ width: '40px', height: '40px', borderRadius: '3px', overflow: 'hidden', background: '#F5F5F5', flexShrink: 0 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.image_url} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
              {group.count > 8 && (
                <div style={{ width: '40px', height: '40px', borderRadius: '3px', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#BDBDBD' }}>
                  +{group.count - 8}
                </div>
              )}
            </div>

            {/* When */}
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '12px', color: '#111' }}>{group.date}</p>
              <p style={{ fontSize: '11px', color: '#BDBDBD', marginTop: '3px' }}>{group.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
