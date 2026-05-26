import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMaterials, getProjectBySlug } from '@/lib/supabase/server-queries'
import { MaterialWithTags } from '@/types'

interface Props {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url)
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const project = await getProjectBySlug(slug)

  if (!project) notFound()

  const materials = await getMaterials({ projectId: project.id })
  const font = '"Helvetica Neue", "PingFang SC", Arial, sans-serif'

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: font }}>
      <header className="page-shell-pad" style={{ borderBottom: '1px solid #e8e8e8', padding: '16px 48px' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#aaa', fontSize: '12px', fontFamily: font }}>
          ← 返回素材库
        </Link>
      </header>

      <section className="project-hero page-shell-pad" style={{ padding: '48px 48px 36px', maxWidth: '1400px', margin: '0 auto' }}>
        <p style={{ fontSize: '11px', color: '#BDBDBD', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
          PROJECT
        </p>
        <div className="project-hero-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '32px' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(36px, 5.5vw, 80px)', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color: '#111' }}>
              {project.name}
            </h1>
            {project.description && (
              <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.7, marginTop: '16px', maxWidth: '560px' }}>
                {project.description}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right', color: '#BDBDBD' }}>
            <p style={{ fontSize: '42px', fontWeight: 700, color: '#111', lineHeight: 1 }}>{materials.length}</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>张参考</p>
          </div>
        </div>
      </section>

      <section className="page-shell-pad" style={{ padding: '0 48px 80px', maxWidth: '1400px', margin: '0 auto' }}>
        {materials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#aaa', fontSize: '13px' }}>
            这个项目还没有参考图
          </div>
        ) : (
          <div className="material-masonry" style={{ columns: 5, columnGap: '20px' }}>
            {materials.map(material => (
              <ProjectMaterialCard key={material.id} material={material} font={font} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ProjectMaterialCard({ material, font }: { material: MaterialWithTags; font: string }) {
  const isVideo = isVideoUrl(material.image_url)

  return (
    <Link href={`/material/${material.id}`} style={{ textDecoration: 'none', display: 'block', breakInside: 'avoid', marginBottom: '24px' }}>
      <div style={{ background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px', position: 'relative' }}>
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
      </div>
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111', lineHeight: 1.35, marginBottom: '5px', fontFamily: font }}>
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
