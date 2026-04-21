import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getMaterialById, getMaterials, getAllTags } from '@/lib/supabase/server-queries'
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

  const [material, allMaterials, allTags] = await Promise.all([
    getMaterialById(id),
    getMaterials(),
    getAllTags(),
  ])

  if (!material) notFound()

  // Determine the primary dimension from this material's tags
  const primaryDim: TagDimension =
    (material.tags?.[0]?.dimension as TagDimension) || 'scene'

  // Tags in that dimension for the top bar
  const dimTags = allTags.filter(t => t.dimension === primaryDim)

  // Group this material's tags by dimension
  const tagsByDim = {
    scene:   (material.tags || []).filter(t => t.dimension === 'scene'),
    style:   (material.tags || []).filter(t => t.dimension === 'style'),
    element: (material.tags || []).filter(t => t.dimension === 'element'),
  }

  // More materials (exclude current)
  const more = allMaterials.filter(m => m.id !== material.id)

  const font = '"Helvetica Neue", "PingFang SC", Arial, sans-serif'

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: font }}>

      {/* Top nav — dimension label + tag row */}
      <header style={{ borderBottom: '1px solid #e8e8e8' }}>
        <div style={{ padding: '20px 48px 0' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '11px', color: '#aaa', letterSpacing: '0.05em' }}>
              {DIM_LABEL[primaryDim]}
            </span>
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 0, padding: '0 48px' }}>
          {dimTags.map(tag => {
            const active = material.tags?.some(t => t.id === tag.id)
            return (
              <Link
                key={tag.id}
                href={`/?dim=${primaryDim}&tag=${tag.slug}`}
                style={{
                  display: 'inline-block',
                  padding: '10px 16px 10px 0',
                  marginRight: '8px',
                  fontSize: '12px',
                  color: active ? '#111' : '#bbb',
                  fontWeight: active ? 500 : 400,
                  textDecoration: 'none',
                  borderBottom: active ? '2px solid #111' : '2px solid transparent',
                  transition: 'color 0.15s',
                }}
              >
                {tag.name}
              </Link>
            )
          })}
        </div>
      </header>

      {/* Main content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '64px', padding: '56px 48px 80px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Image */}
        <div style={{ background: '#f7f7f7' }}>
          <Image
            src={material.image_url}
            alt={material.title}
            width={900}
            height={700}
            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
            unoptimized
            priority
          />
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
            <h2 style={{ fontSize: '36px', fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>
              Read more
            </h2>
            <span style={{ fontSize: '28px', color: '#ccc', fontWeight: 300 }}>{more.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
            {more.slice(0, 12).map(m => (
              <Link key={m.id} href={`/material/${m.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#f5f5f5', aspectRatio: '1', overflow: 'hidden', marginBottom: '8px' }}>
                  <Image
                    src={m.image_url}
                    alt={m.title}
                    width={240}
                    height={240}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    unoptimized
                  />
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
