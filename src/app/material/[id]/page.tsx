import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url)
}
import { getMaterialById, getMaterials } from '@/lib/supabase/server-queries'
import { TagDimension } from '@/types'

const DIM_LABEL: Record<TagDimension, string> = {
  scene: '场景',
  style: '风格',
  element: '元素',
}

interface Props {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function MaterialDetailPage({ params }: Props) {
  const { id } = await params

  const [material, allMaterials] = await Promise.all([
    getMaterialById(id),
    getMaterials(),
  ])

  if (!material) notFound()

  // Group this material's tags by dimension
  const tagsByDim = {
    scene:   (material.tags || []).filter(t => t.dimension === 'scene'),
    style:   (material.tags || []).filter(t => t.dimension === 'style'),
    element: (material.tags || []).filter(t => t.dimension === 'element'),
  }

  // Related: share at least one tag, sorted by most shared tags first
  const currentTagIds = new Set((material.tags || []).map(t => t.id))
  const related = allMaterials
    .filter(m => m.id !== material.id)
    .map(m => ({
      ...m,
      sharedCount: (m.tags || []).filter(t => currentTagIds.has(t.id)).length,
    }))
    .filter(m => m.sharedCount > 0)
    .sort((a, b) => b.sharedCount - a.sharedCount)

  // Fallback: if fewer than 6 related, fill with other materials
  const related6 = related.slice(0, 12)
  const fallback = allMaterials
    .filter(m => m.id !== material.id && !related.some(r => r.id === m.id))
    .slice(0, Math.max(0, 12 - related6.length))

  const more = [...related6, ...fallback]

  const font = '"Helvetica Neue", "PingFang SC", Arial, sans-serif'

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: font }}>

      {/* Top nav — back only */}
      <header style={{ borderBottom: '1px solid #e8e8e8', padding: '16px 48px' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#aaa', fontSize: '12px', fontFamily: font }}>
          ← 返回
        </Link>
      </header>

      {/* Main content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '64px', padding: '56px 48px 80px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Media */}
        <div style={{ background: '#f7f7f7' }}>
          {isVideoUrl(material.image_url) ? (
            <video
              src={material.image_url}
              controls
              autoPlay
              loop
              muted
              playsInline
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          ) : (
            <Image
              src={material.image_url}
              alt={material.title}
              width={900}
              height={700}
              style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
              unoptimized
              priority
            />
          )}
        </div>

        {/* Info */}
        <div style={{ paddingTop: '8px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111', lineHeight: 1.2, letterSpacing: '-0.01em', marginBottom: '12px' }}>
            {material.title}
          </h1>
          {material.description && (
            <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.7, marginBottom: '40px' }}>
              {material.description}
            </p>
          )}

          {/* Tags by dimension */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {(Object.keys(tagsByDim) as TagDimension[]).map(dim => {
              const tags = tagsByDim[dim]
              if (!tags.length) return null
              return (
                <div key={dim} style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: '8px', alignItems: 'start' }}>
                  <span style={{ fontSize: '11px', color: '#bbb', paddingTop: '2px' }}>
                    {DIM_LABEL[dim]}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {tags.map(tag => (
                      <Link
                        key={tag.id}
                        href={`/?dim=${dim}&tag=${tag.slug}`}
                        className="tag-link"
                        style={{ fontSize: '12px', color: '#333', textDecoration: 'none', padding: '2px 0' }}
                      >
                        {tag.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Author */}
            {material.author && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f7f7f7', borderRadius: '2px', marginTop: '8px' }}>
                <span style={{ fontSize: '10px', color: '#999', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>由 TA 推荐</span>
                <span style={{ fontSize: '13px', color: '#111', fontWeight: 600, letterSpacing: '0.02em' }}>{material.author}</span>
              </div>
            )}

            {/* Source */}
            {(material.source_platform || material.source_url) && (
              <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: '8px', alignItems: 'start', paddingTop: '12px', borderTop: '1px solid #f0f0f0', marginTop: '4px' }}>
                <span style={{ fontSize: '11px', color: '#bbb', paddingTop: '2px' }}>来源</span>
                {material.source_url ? (
                  <a
                    href={material.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: '#333', textDecoration: 'none' }}
                  >
                    {material.source_platform || material.source_url} ↗
                  </a>
                ) : (
                  <span style={{ fontSize: '12px', color: '#333' }}>{material.source_platform}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* More materials */}
      {more.length > 0 && (
        <div style={{ padding: '0 48px 80px', maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div>
              <h2 style={{ fontSize: '36px', fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>
                MORE
              </h2>
              {related6.length > 0 && (
                <p style={{ fontSize: '11px', color: '#bbb', marginTop: '4px' }}>
                  按相关标签推荐 · {related6.length} 个匹配
                </p>
              )}
            </div>
            <span style={{ fontSize: '28px', color: '#ccc', fontWeight: 300 }}>{more.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
            {more.slice(0, 12).map(m => (
              <Link key={m.id} href={`/material/${m.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#f5f5f5', aspectRatio: '1', overflow: 'hidden', marginBottom: '8px' }}>
                  {isVideoUrl(m.image_url) ? (
                    <video
                      src={m.image_url}
                      muted
                      autoPlay
                      loop
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <Image
                      src={m.image_url}
                      alt={m.title}
                      width={240}
                      height={240}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      unoptimized
                    />
                  )}
                </div>
                <p style={{ fontSize: '11px', color: '#111', fontWeight: 500, lineHeight: 1.4, margin: 0 }}>
                  {m.title}
                </p>
                {m.description && (
                  <p style={{ fontSize: '10px', color: '#aaa', marginTop: '3px', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {m.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
