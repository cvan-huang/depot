'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { MOCK_TAGS, MOCK_MATERIALS } from '@/lib/mock-data'
import { TagDimension, MaterialWithTags, Tag } from '@/types'

const DIMENSIONS: { key: TagDimension; label: string }[] = [
  { key: 'scene', label: '场景' },
  { key: 'style', label: '风格' },
  { key: 'element', label: '元素' },
]

const USE_SUPABASE = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function GalleryView() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const dimParam = (searchParams.get('dim') as TagDimension) || 'scene'
  const tagParam = searchParams.get('tag') || ''

  const [activeDim, setActiveDim] = useState<TagDimension>(dimParam)
  const [activeTag, setActiveTag] = useState(tagParam)
  const [allTags, setAllTags] = useState<Tag[]>(MOCK_TAGS)
  const [materials, setMaterials] = useState<MaterialWithTags[]>([])
  const [loading, setLoading] = useState(false)

  // Load tags
  useEffect(() => {
    if (!USE_SUPABASE) { setAllTags(MOCK_TAGS); return }
    import('@/lib/supabase/queries').then(({ getAllTags }) => {
      getAllTags().then(tags => { if (tags.length) setAllTags(tags) })
    })
  }, [])

  // Load materials when filter changes
  useEffect(() => {
    setLoading(true)
    if (!USE_SUPABASE) {
      let results = [...MOCK_MATERIALS]
      if (activeTag) results = results.filter(m => m.tags.some(t => t.slug === activeTag))
      else results = results.filter(m => m.tags.some(t => t.dimension === activeDim))
      setMaterials(results)
      setLoading(false)
      return
    }
    import('@/lib/supabase/queries').then(({ getMaterials }) => {
      getMaterials({ dimension: activeDim, tagSlug: activeTag || undefined })
        .then(data => { setMaterials(data); setLoading(false) })
    })
  }, [activeDim, activeTag])

  const dimTags = useMemo(() => allTags.filter(t => t.dimension === activeDim), [allTags, activeDim])

  const handleDimClick = (dim: TagDimension) => {
    setActiveDim(dim)
    setActiveTag('')
    router.push(`/?dim=${dim}`, { scroll: false })
  }

  const handleTagClick = (slug: string) => {
    const next = activeTag === slug ? '' : slug
    setActiveTag(next)
    router.push(`/?dim=${activeDim}${next ? `&tag=${next}` : ''}`, { scroll: false })
  }


  return (
    <div className="min-h-screen bg-white">

      {/* ─── HEADER ─── */}
      <header style={{ padding: '36px 48px 68px 48px' }}>
        {/* Same 6-col grid as the material grid below */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          columnGap: '20px',
          alignItems: 'start',
        }}>

          {/* Reference Library — spans col 1–2 */}
          <div style={{ gridColumn: '1 / 3', marginTop: '-5px' }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <h1 style={{
                fontSize: 'clamp(28px, 4vw, 56px)',
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: '#111',
                fontFamily: '"Helvetica Neue", "PingFang SC", Arial, sans-serif',
                wordBreak: 'keep-all',
              }}>
                Reference Library
              </h1>
            </Link>
          </div>

          {/* 场景 — col 3, 风格 — col 4, 元素 — col 5 */}
          {DIMENSIONS.map((dim) => {
            const tags = allTags.filter(t => t.dimension === dim.key)
            const isActive = activeDim === dim.key
            return (
              <button
                key={dim.key}
                onClick={() => handleDimClick(dim.key)}
                style={{
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <p style={{
                  fontSize: '16px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#111' : '#c0c0c0',
                  marginBottom: '8px',
                  lineHeight: 1.2,
                  fontFamily: '"Helvetica Neue", "PingFang SC", Arial, sans-serif',
                  transition: 'color 0.15s',
                }}>
                  {dim.label}
                </p>
                <p style={{
                  fontSize: '12px',
                  color: isActive ? '#666' : '#c8c8c8',
                  lineHeight: 1.8,
                  fontFamily: '"Helvetica Neue", "PingFang SC", Arial, sans-serif',
                  transition: 'color 0.15s',
                }}>
                  {tags.map(t => t.name).join(' / ')}
                </p>
              </button>
            )
          })}

          {/* col 6 — logo */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/REDesign logo.svg"
              alt="REDesign"
              style={{ height: '28px', width: 'auto' }}
            />
          </div>

        </div>
      </header>

      {/* ─── TAG BAR ─── */}
      <div style={{
        borderTop: '1px solid #e8e8e8',
        padding: '0 48px',
        display: 'flex',
        alignItems: 'center',
      }}>
        {/* 全部 button */}
        <button
          onClick={() => { setActiveTag(''); router.push(`/?dim=${activeDim}`, { scroll: false }) }}
          style={{
            padding: '14px 16px 12px 0',
            marginRight: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: '"Helvetica Neue", "PingFang SC", Arial, sans-serif',
            color: !activeTag ? '#111' : '#aaa',
            fontWeight: !activeTag ? 500 : 400,
            borderBottom: !activeTag ? '2px solid #111' : '2px solid transparent',
            transition: 'color 0.15s',
          }}
        >
          全部
        </button>

        {dimTags.map(tag => {
          const isActive = !!activeTag && activeTag === tag.slug
          return (
            <button
              key={tag.id}
              onClick={() => handleTagClick(tag.slug)}
              style={{
                padding: '14px 16px 12px 0',
                marginRight: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: '"Helvetica Neue", "PingFang SC", Arial, sans-serif',
                color: isActive ? '#111' : '#aaa',
                fontWeight: isActive ? 500 : 400,
                position: 'relative',
                borderBottom: isActive ? '2px solid #111' : '2px solid transparent',
                transition: 'color 0.15s',
              }}
            >
              {tag.name}
            </button>
          )
        })}
      </div>

      {/* ─── GRID ─── */}
      <div style={{ padding: '40px 48px 80px 48px' }}>
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
            暂无素材
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            columnGap: '20px',
            rowGap: '48px',
          }}>
            {materials.map(material => (
              <MaterialGridCard key={material.id} material={material} />
            ))}
          </div>
        )}
      </div>

      {/* Admin link */}
      <Link
        href="/admin"
        style={{
          position: 'fixed', bottom: '20px', right: '24px',
          fontSize: '11px', color: '#ccc', textDecoration: 'none',
          fontFamily: '"Helvetica Neue", Arial, sans-serif',
        }}
      >
        管理后台
      </Link>
    </div>
  )
}

function MaterialGridCard({ material }: { material: MaterialWithTags }) {
  return (
    <Link href={`/material/${material.id}`} style={{ textDecoration: 'none', display: 'block' }} className="card-wrap">
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '4 / 3',
        backgroundColor: '#f0f0f0', borderRadius: '3px',
        overflow: 'hidden', marginBottom: '12px',
      }}>
        <Image
          src={material.image_url}
          alt={material.title}
          fill
          className="card-img"
          style={{ objectFit: 'cover' }}
          sizes="(max-width: 1280px) 20vw, 16vw"
          unoptimized
        />
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
        fontFamily: '"Helvetica Neue", "PingFang SC", Arial, sans-serif',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
      }}>
        {material.title}
      </p>
      {material.description && (
        <p style={{
          fontSize: '11px', color: '#999', lineHeight: 1.55,
          fontFamily: '"Helvetica Neue", "PingFang SC", Arial, sans-serif',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {material.description}
        </p>
      )}
    </Link>
  )
}
