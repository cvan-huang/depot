'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MOCK_MATERIALS } from '@/lib/mock-data'
import { MaterialWithTags, Project, TagDimension } from '@/types'

const USE_SUPABASE = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const PAGE_SIZE = 60
const GALLERY_RESTORE_KEY = 'depot-gallery-restore'

interface GalleryRestoreState {
  href: string
  scrollY: number
  loadedCount: number
  savedAt: number
}

export default function GalleryView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlSearch = searchParams.get('q') || ''
  const urlDim = searchParams.get('dim') as TagDimension | null
  const urlTag = searchParams.get('tag') || ''
  const search = urlSearch
  const searchString = searchParams.toString()
  const currentHref = searchString ? `${pathname}?${searchString}` : pathname
  const [allMaterials, setAllMaterials] = useState<MaterialWithTags[]>(() => USE_SUPABASE ? [] : MOCK_MATERIALS)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(USE_SUPABASE)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState<number | null>(USE_SUPABASE ? null : MOCK_MATERIALS.length)
  const restoreRef = useRef<GalleryRestoreState | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!USE_SUPABASE) {
      return
    }
    let cancelled = false
    import('@/lib/supabase/queries').then(({ getMaterialsPage, getProjects }) => {
      Promise.resolve().then(async () => {
        const restore = readGalleryRestore(currentHref)
        restoreRef.current = restore
        const initialLimit = restore ? Math.max(PAGE_SIZE, restore.loadedCount) : PAGE_SIZE
        setLoading(true)
        setLoadingMore(false)
        const [page, projectData] = await Promise.all([
          getMaterialsPage({
            limit: initialLimit,
            offset: 0,
            search: urlSearch || undefined,
            dimension: urlDim || undefined,
            tagSlug: urlTag || undefined,
          }),
          getProjects(),
        ])

        if (cancelled) return
        setAllMaterials(page.materials)
        setProjects(projectData)
        setHasMore(page.hasMore)
        setTotalCount(page.total)
        setLoading(false)
      })
    })
    return () => { cancelled = true }
  }, [currentHref, urlDim, urlSearch, urlTag])

  const materials = useMemo(() => {
    if (USE_SUPABASE) return allMaterials

    const q = search.trim().toLowerCase()
    return allMaterials.filter(m =>
      (!q ||
        m.title.toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q) ||
        (m.project?.name || '').toLowerCase().includes(q) ||
        (m.tags || []).some(t => t.name.toLowerCase().includes(q))) &&
      (urlTag
        ? (m.tags || []).some(t => t.slug === urlTag)
        : urlDim
          ? (m.tags || []).some(t => t.dimension === urlDim)
          : true)
    )
  }, [allMaterials, search, urlDim, urlTag])

  useEffect(() => {
    if (loading) return
    const restore = restoreRef.current
    if (!restore) return

    restoreRef.current = null
    requestAnimationFrame(() => {
      window.scrollTo({ top: restore.scrollY, behavior: 'auto' })
      requestAnimationFrame(() => {
        window.scrollTo({ top: restore.scrollY, behavior: 'auto' })
      })
      window.setTimeout(() => {
        window.scrollTo({ top: restore.scrollY, behavior: 'auto' })
      }, 300)
    })
  }, [loading, materials.length])

  const matchedProjects = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return projects.filter(project =>
      project.name.toLowerCase().includes(q) ||
      (project.description || '').toLowerCase().includes(q)
    )
  }, [projects, search])

  const activeTag = useMemo(() => {
    if (!urlTag) return null
    return allMaterials.flatMap(material => material.tags || []).find(tag => tag.slug === urlTag) || null
  }, [allMaterials, urlTag])
  const hasRouteFilter = Boolean(urlSearch || urlDim || urlTag)

  const handleSearchChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value.trim()) params.set('q', value)
    else params.delete('q')
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname)
  }

  const clearRouteFilter = () => {
    router.replace(pathname)
  }

  const loadMore = useCallback(async () => {
    if (!USE_SUPABASE || loading || loadingMore || !hasMore) return

    setLoadingMore(true)
    const { getMaterialsPage } = await import('@/lib/supabase/queries')
    const page = await getMaterialsPage({
      limit: PAGE_SIZE,
      offset: allMaterials.length,
      search: urlSearch || undefined,
      dimension: urlDim || undefined,
      tagSlug: urlTag || undefined,
    })

    setAllMaterials(prev => {
      const ids = new Set(prev.map(material => material.id))
      return [...prev, ...page.materials.filter(material => !ids.has(material.id))]
    })
    setHasMore(page.hasMore)
    setTotalCount(page.total)
    setLoadingMore(false)
  }, [allMaterials.length, hasMore, loading, loadingMore, urlDim, urlSearch, urlTag])

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          void loadMore()
        }
      },
      { rootMargin: '600px 0px' }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, loadMore, loading, loadingMore])

  const rememberGalleryPosition = () => {
    if (typeof window === 'undefined') return
    const state: GalleryRestoreState = {
      href: currentHref,
      scrollY: window.scrollY,
      loadedCount: materials.length,
      savedAt: Date.now(),
    }
    sessionStorage.setItem(GALLERY_RESTORE_KEY, JSON.stringify(state))
  }

  const font = '"Helvetica Neue", "PingFang SC", Arial, sans-serif'

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: font }}>

      {/* ─── HEADER ─── */}
      <header className="public-header" style={{ padding: '36px 48px 30px', position: 'relative' }}>
        <div className="public-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ width: 'fit-content' }}>
              <h1 style={{
                marginLeft: '-6px',
                fontSize: 'clamp(112px, 16vw, 224px)',
                fontWeight: 500,
                lineHeight: 1.0,
                letterSpacing: '-0.03em',
                color: '#111',
                fontFamily: '"Helvetica Neue", Arial, sans-serif',
              }}>
                <span style={{ marginRight: '12px' }}>(</span>
                <span style={{ position: 'relative', top: '0.07em' }}>0.1</span>
                )
              </h1>
            </div>
          </Link>
          <div
            className="public-brand-lockup"
            style={{
              position: 'absolute',
              top: '87px',
              right: '48px',
              width: '280px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '74px',
              pointerEvents: 'none',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/REDesign logo.svg"
              alt="REDesign"
              style={{ height: '34px', width: 'auto' }}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr 36px',
                alignItems: 'center',
                width: '100%',
                minHeight: '76px',
                color: '#111',
                fontFamily: '"Helvetica Neue", Arial, sans-serif',
                fontWeight: 500,
                lineHeight: 0.95,
              }}
            >
              <span style={{ fontSize: 'clamp(56px, 5vw, 76px)', lineHeight: 0.9, justifySelf: 'start' }}>(</span>
              <span style={{ fontSize: 'clamp(22px, 2.05vw, 29px)', letterSpacing: '-0.03em', textAlign: 'center', justifySelf: 'center', transform: 'translateY(8px)' }}>
                <span style={{ display: 'block', whiteSpace: 'nowrap' }}>Visual Reference</span>
                <span style={{ display: 'block' }}>Library</span>
              </span>
              <span style={{ fontSize: 'clamp(56px, 5vw, 76px)', lineHeight: 0.9, justifySelf: 'end' }}>)</span>
            </div>
          </div>
        </div>

        {/* ─── SEARCH ─── */}
        <div className="public-search" style={{ marginTop: '84px', maxWidth: '400px' }}>
          <input
            type="text"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder='搜索关键词"字体设计、排版设计、项目名"'
            style={{
              width: '100%',
              height: '40px',
              padding: '0 14px',
              fontSize: '13px',
              fontFamily: font,
              color: '#111',
              background: '#F5F5F5',
              border: '1px solid #E8E8E8',
              borderRadius: '999px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {hasRouteFilter && (
            <button
              type="button"
              onClick={clearRouteFilter}
              style={{
                marginTop: '10px',
                border: 'none',
                background: 'transparent',
                color: '#999',
                fontSize: '11px',
                cursor: 'pointer',
                padding: 0,
                fontFamily: font,
              }}
            >
              清除筛选
            </button>
          )}
        </div>
      </header>

      {/* ─── MASONRY GRID ─── */}
      <div className="public-content" style={{ padding: '8px 48px 80px' }}>
        {matchedProjects.length > 0 && (
          <div style={{ marginBottom: '28px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {matchedProjects.map(project => (
              <Link
                key={project.id}
                href={`/project/${project.slug}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  border: '1px solid #E8E8E8',
                  borderRadius: '999px',
                  color: '#111',
                  textDecoration: 'none',
                  background: '#FAFAFA',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: '#BDBDBD', fontSize: '10px', letterSpacing: '0.08em' }}>PROJECT</span>
                <strong style={{ fontWeight: 600 }}>{project.name}</strong>
              </Link>
            ))}
          </div>
        )}
        {(urlTag || urlDim) && (
          <div style={{ marginBottom: '22px', display: 'flex', alignItems: 'center', gap: '10px', color: '#888', fontSize: '12px' }}>
            <span style={{ color: '#BDBDBD', letterSpacing: '0.08em', fontSize: '10px' }}>FILTER</span>
            <strong style={{ color: '#111', fontWeight: 600 }}>
              {activeTag?.name || (urlDim === 'scene' ? '场景' : urlDim === 'style' ? '风格' : '元素')}
            </strong>
            <span>{totalCount ?? materials.length} 张素材</span>
          </div>
        )}
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
          <>
            <div className="material-masonry" style={{
              columns: 5,
              columnGap: '20px',
            }}>
              {materials.map((material, index) => (
                <MaterialCard
                  key={material.id}
                  material={material}
                  font={font}
                  priority={index < 5}
                  onNavigate={rememberGalleryPosition}
                />
              ))}
            </div>
            {USE_SUPABASE && (
              <div ref={loadMoreRef} aria-hidden="true" style={{ height: '1px' }} />
            )}
          </>
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
        className="upload-fab floating-upload"
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

function readGalleryRestore(href: string): GalleryRestoreState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = sessionStorage.getItem(GALLERY_RESTORE_KEY)
    if (!raw) return null
    const restore = JSON.parse(raw) as GalleryRestoreState
    const isFresh = Date.now() - restore.savedAt < 1000 * 60 * 30
    if (!isFresh || restore.href !== href) return null
    return restore
  } catch {
    return null
  }
}

function MaterialCard({
  material,
  font,
  priority,
  onNavigate,
}: {
  material: MaterialWithTags
  font: string
  priority?: boolean
  onNavigate: () => void
}) {
  const isVideo = isVideoUrl(material.image_url)
  const [mediaLoaded, setMediaLoaded] = useState(false)
  const mediaStyle = {
    width: '100%',
    height: 'auto',
    display: 'block',
    opacity: mediaLoaded ? 1 : 0,
    transition: 'opacity 180ms ease',
  }

  return (
    <div style={{ breakInside: 'avoid', marginBottom: '24px' }}>
      <Link
        href={`/material/${material.id}`}
        onClick={onNavigate}
        style={{ textDecoration: 'none', display: 'block' }}
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
              onLoadedData={() => setMediaLoaded(true)}
              style={mediaStyle}
            />
          ) : (
            <Image
              src={material.image_url}
              alt={material.title}
              width={400}
              height={300}
              style={mediaStyle}
              sizes="(max-width: 1280px) 20vw, 16vw"
              unoptimized
              priority={priority}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={() => setMediaLoaded(true)}
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
      </Link>
      {material.project && (
        <Link
          href={`/project/${material.project.slug}`}
          onClick={onNavigate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '10px',
            padding: '2px 7px',
            borderRadius: '999px',
            backgroundColor: '#F0F0F0',
            color: '#888',
            textDecoration: 'none',
            marginBottom: '5px',
            fontFamily: font,
            fontWeight: 600,
          }}
        >
          {material.project.name}
        </Link>
      )}
      {(material.tags || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
          {(material.tags || []).slice(0, 4).map(tag => (
            <Link
              key={tag.id}
              href={`/?dim=${tag.dimension}&tag=${tag.slug}`}
              onClick={onNavigate}
              style={{
                fontSize: '10px',
                padding: '2px 7px',
                borderRadius: '999px',
                backgroundColor: tag.color ? `${tag.color}22` : '#F0F0F0',
                color: tag.color || '#888',
                fontFamily: font,
                textDecoration: 'none',
              }}
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
