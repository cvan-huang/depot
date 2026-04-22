'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { MOCK_MATERIALS } from '@/lib/mock-data'
import { MaterialWithTags } from '@/types'

const USE_SUPABASE = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function GalleryView() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [allMaterials, setAllMaterials] = useState<MaterialWithTags[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    if (!USE_SUPABASE) {
      setAllMaterials(MOCK_MATERIALS)
      setLoading(false)
      return
    }
    import('@/lib/supabase/queries').then(({ getMaterials }) => {
      getMaterials().then(data => {
        setAllMaterials(data)
        setLoading(false)
      })
    })
  }, [])

  const materials = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allMaterials
    return allMaterials.filter(m =>
      m.title.toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q) ||
      (m.tags || []).some(t => t.name.toLowerCase().includes(q))
    )
  }, [allMaterials, search])

  const font = '"Helvetica Neue", "PingFang SC", Arial, sans-serif'

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: font }}>

      {/* ─── HEADER ─── */}
      <header style={{ padding: '36px 48px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <h1 style={{
              fontSize: 'clamp(36px, 5.5vw, 80px)',
              fontWeight: 700,
              lineHeight: 1.0,
              letterSpacing: '-0.03em',
              color: '#111',
              fontFamily: font,
            }}>
              Reference Library
            </h1>
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/REDesign logo.svg"
            alt="REDesign"
            style={{ height: '28px', width: 'auto', marginTop: '10px' }}
          />
        </div>

        {/* ─── SEARCH ─── */}
        <div style={{ marginTop: '74px', maxWidth: '480px' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='搜索关键词"字体设计、排版设计"'
            style={{
              width: '100%',
              height: '40px',
              padding: '0 14px',
              fontSize: '13px',
              fontFamily: font,
              color: '#111',
              background: '#F5F5F5',
              border: '1px solid #E8E8E8',
              borderRadius: '6px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </header>

      {/* ─── MASONRY GRID ─── */}
      <div style={{ padding: '8px 48px 80px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{
              width: '24px', height: '24px',
              border: '2px solid #eee',
              borderTopColor: '#111',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : materials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#aaa', fontSize: '13px' }}>
            {search ? `没有找到「${search}」相关的素材` : '暂无素材'}
          </div>
        ) : (
          <div style={{
            columns: 5,
            columnGap: '20px',
          }}>
            {materials.map(material => (
              <MaterialCard key={material.id} material={material} font={font} />
            ))}
          </div>
        )}
      </div>

      {/* Floating upload entry */}
      <Link
        href="/admin/upload"
        title="上传素材"
        style={{
          position: 'fixed', bottom: '28px', right: '28px',
          width: '44px', height: '44px',
          borderRadius: '50%',
          backgroundColor: '#111',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          textDecoration: 'none',
          transition: 'background-color 0.15s, transform 0.15s',
        }}
        className="upload-fab"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 3V13M9 3L5 7M9 3L13 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 15H16" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </Link>
      <style>{`.upload-fab:hover { background-color: #FF2442 !important; transform: scale(1.08); }`}</style>
    </div>
  )
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url)
}

function MaterialCard({ material, font }: { material: MaterialWithTags; font: string }) {
  const isVideo = isVideoUrl(material.image_url)
  return (
    <Link
      href={`/material/${material.id}`}
      style={{ textDecoration: 'none', display: 'block', breakInside: 'avoid', marginBottom: '24px' }}
    >
      <div style={{
        background: '#f0f0f0',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '10px',
        position: 'relative',
      }}>
        {isVideo ? (
          <video
            src={material.image_url}
            muted
            autoPlay
            loop
            playsInline
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        ) : (
          <Image
            src={material.image_url}
            alt={material.title}
            width={400}
            height={300}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            sizes="(max-width: 1280px) 20vw, 16vw"
            unoptimized
          />
        )}
        {material.is_featured && (
          <div style={{
            position: 'absolute', top: '8px', right: '8px',
            width: '6px', height: '6px',
            borderRadius: '50%', backgroundColor: '#FF2442',
          }} />
        )}
      </div>
      <p style={{
        fontSize: '13px', fontWeight: 600, color: '#111',
        lineHeight: 1.35, marginBottom: '5px',
        fontFamily: font,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
      }}>
        {material.title}
      </p>
      {(material.tags || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
          {(material.tags || []).slice(0, 4).map(tag => (
            <span
              key={tag.id}
              style={{
                fontSize: '10px',
                padding: '2px 7px',
                borderRadius: '999px',
                backgroundColor: tag.color ? `${tag.color}22` : '#F0F0F0',
                color: tag.color || '#888',
                fontFamily: font,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
