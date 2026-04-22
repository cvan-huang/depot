'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { MaterialWithTags, Tag } from '@/types'
import { cn } from '@/lib/utils'

const DIM_LABELS = { scene: '场景', style: '风格', element: '元素' } as const

export default function ManagePage() {
  const [materials, setMaterials] = useState<MaterialWithTags[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [editItem, setEditItem] = useState<MaterialWithTags | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', source_url: '', source_platform: '', author: '' })
  const [editTags, setEditTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    import('@/lib/supabase/queries').then(({ getMaterials, getAllTags }) => {
      Promise.all([getMaterials(), getAllTags()]).then(([data, tags]) => {
        setMaterials(data)
        setAllTags(tags)
        setLoading(false)
      })
    })
  }, [])

  const filtered = materials.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase())
  )

  const handleToggleFeatured = async (id: string, current: boolean) => {
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, is_featured: !m.is_featured } : m))
    try {
      const { toggleFeatured } = await import('@/lib/supabase/queries')
      await toggleFeatured(id, !current)
    } catch {
      setMaterials(prev => prev.map(m => m.id === id ? { ...m, is_featured: current } : m))
    }
  }

  const handleDelete = async (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id))
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    setDeleteId(null)
    try {
      const { deleteMaterial } = await import('@/lib/supabase/queries')
      await deleteMaterial(id)
    } catch {
      const { getMaterials } = await import('@/lib/supabase/queries')
      setMaterials(await getMaterials())
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selected)
    setBulkDeleting(true)
    setShowBulkConfirm(false)
    setMaterials(prev => prev.filter(m => !selected.has(m.id)))
    setSelected(new Set())
    try {
      const { deleteMaterial } = await import('@/lib/supabase/queries')
      await Promise.all(ids.map(id => deleteMaterial(id)))
    } catch {
      const { getMaterials } = await import('@/lib/supabase/queries')
      setMaterials(await getMaterials())
    }
    setBulkDeleting(false)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(m => m.id)))
  }

  const openEdit = (m: MaterialWithTags) => {
    setEditItem(m)
    setEditForm({
      title: m.title,
      description: m.description || '',
      source_url: m.source_url || '',
      source_platform: m.source_platform || '',
      author: (m as any).author || '',
    })
    setEditTags((m.tags || []).map(t => t.id))
  }

  const toggleEditTag = (tagId: string) => {
    setEditTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId])
  }

  const handleSaveEdit = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      const { updateMaterial, updateMaterialTags } = await import('@/lib/supabase/queries')
      await Promise.all([
        updateMaterial(editItem.id, editForm),
        updateMaterialTags(editItem.id, editTags),
      ])
      const updatedTags = allTags.filter(t => editTags.includes(t.id))
      setMaterials(prev => prev.map(m => m.id === editItem.id ? { ...m, ...editForm, tags: updatedTags } : m))
      setEditItem(null)
    } catch (e: any) {
      alert(e.message)
    }
    setSaving(false)
  }

  const font = '"Helvetica Neue", "PingFang SC", Arial, sans-serif'

  return (
    <div style={{ fontFamily: font }}>
      {/* Header */}
      <div style={{ padding: '32px 40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', color: '#111' }}>管理素材</h1>
          <p style={{ fontSize: '12px', color: '#BDBDBD', marginTop: '4px' }}>
            {loading ? '加载中...' : `共 ${materials.length} 个素材`}
            {selected.size > 0 && <span style={{ color: '#FF2442', marginLeft: '8px' }}>· 已选 {selected.size} 个</span>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {selected.size > 0 && (
            <button
              onClick={() => setShowBulkConfirm(true)}
              disabled={bulkDeleting}
              style={{ height: '36px', padding: '0 16px', background: '#111', color: '#fff', border: 'none', fontSize: '12px', cursor: 'pointer', fontFamily: font }}
            >
              {bulkDeleting ? '删除中...' : `删除所选 (${selected.size})`}
            </button>
          )}
          <input
            type="text"
            placeholder="搜索素材..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ height: '36px', padding: '0 12px', border: '1px solid #EBEBEB', fontSize: '12px', width: '180px', outline: 'none', fontFamily: font, background: '#FAFAFA' }}
          />
        </div>
      </div>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '40px 72px 1fr 1fr 80px', gap: '16px', padding: '12px 40px', borderBottom: '1px solid #EBEBEB', background: '#FAFAFA' }}>
        <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleSelectAll} style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#111' }} />
        <span style={{ fontSize: '11px', color: '#BDBDBD' }}>封面</span>
        <span style={{ fontSize: '11px', color: '#BDBDBD' }}>标题</span>
        <span style={{ fontSize: '11px', color: '#BDBDBD' }}>标签</span>
        <span style={{ fontSize: '11px', color: '#BDBDBD' }}>操作</span>
      </div>

      {loading && (
        <div style={{ padding: '60px', textAlign: 'center', color: '#BDBDBD', fontSize: '13px' }}>加载中...</div>
      )}

      {!loading && filtered.map(m => (
        <div
          key={m.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '40px 72px 1fr 1fr 80px',
            gap: '16px',
            padding: '16px 40px',
            borderBottom: '1px solid #F0F0F0',
            alignItems: 'center',
            background: selected.has(m.id) ? '#FAFAFA' : '#fff',
          }}
        >
          <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#111' }} />

          <div style={{ width: '64px', height: '48px', overflow: 'hidden', background: '#F5F5F5', borderRadius: '2px' }}>
            <Image src={m.image_url} alt={m.title} width={64} height={48} style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
          </div>

          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#111', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{m.title}</p>
            {m.description && <p style={{ fontSize: '11px', color: '#BDBDBD', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{m.description}</p>}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {(m.tags || []).map(t => (
              <span key={t.id} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', backgroundColor: t.color ? `${t.color}18` : '#F5F5F5', color: t.color || '#888' }}>
                {t.name}
              </span>
            ))}
            {(m.tags || []).length === 0 && <span style={{ fontSize: '11px', color: '#BDBDBD' }}>无标签</span>}
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={() => openEdit(m)} style={{ fontSize: '12px', color: '#BDBDBD', background: 'none', border: 'none', cursor: 'pointer', fontFamily: font, padding: 0 }}
              onMouseOver={e => (e.currentTarget.style.color = '#111')} onMouseOut={e => (e.currentTarget.style.color = '#BDBDBD')}>编辑</button>
            <button onClick={() => setDeleteId(m.id)} style={{ fontSize: '12px', color: '#BDBDBD', background: 'none', border: 'none', cursor: 'pointer', fontFamily: font, padding: 0 }}
              onMouseOver={e => (e.currentTarget.style.color = '#FF2442')} onMouseOut={e => (e.currentTarget.style.color = '#BDBDBD')}>删除</button>
          </div>
        </div>
      ))}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: '60px', textAlign: 'center', color: '#BDBDBD', fontSize: '13px' }}>
          {materials.length === 0 ? '暂无素材，去上传吧' : '没有找到匹配的素材'}
        </div>
      )}

      {/* Bulk delete confirm */}
      {showBulkConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', padding: '32px', width: '360px', fontFamily: font }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>删除 {selected.size} 个素材？</h3>
            <p style={{ fontSize: '12px', color: '#BDBDBD', marginBottom: '24px' }}>此操作不可恢复。</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowBulkConfirm(false)} style={{ flex: 1, height: '40px', border: '1px solid #EBEBEB', background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: font }}>取消</button>
              <button onClick={handleBulkDelete} style={{ flex: 1, height: '40px', background: '#111', color: '#fff', border: 'none', fontSize: '13px', cursor: 'pointer', fontFamily: font }}>确认删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', padding: '32px', width: '480px', maxHeight: '80vh', overflowY: 'auto', fontFamily: font }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>编辑素材</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {([
                { label: '标题', key: 'title' },
                { label: '描述', key: 'description' },
                { label: '来源链接', key: 'source_url' },
                { label: '由 TA 推荐', key: 'author' },
              ] as const).map(({ label, key }) => (
                <div key={key}>
                  <label style={{ fontSize: '11px', color: '#BDBDBD', display: 'block', marginBottom: '6px' }}>{label}</label>
                  <input
                    value={editForm[key]}
                    onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #EBEBEB', fontSize: '13px', outline: 'none', fontFamily: font, background: '#FAFAFA' }}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontSize: '11px', color: '#BDBDBD', display: 'block', marginBottom: '6px' }}>来源平台</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['小红书', 'Pinterest', 'Instagram'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, source_platform: prev.source_platform === p ? '' : p }))}
                      style={{
                        flex: 1, height: '36px', border: '1px solid',
                        borderColor: editForm.source_platform === p ? '#111' : '#EBEBEB',
                        background: editForm.source_platform === p ? '#111' : '#fff',
                        color: editForm.source_platform === p ? '#fff' : '#BDBDBD',
                        fontSize: '12px', cursor: 'pointer', fontFamily: font,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#BDBDBD', display: 'block', marginBottom: '8px' }}>标签</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(['scene', 'style', 'element'] as const).map(dim => (
                    <div key={dim}>
                      <p style={{ fontSize: '10px', color: '#BDBDBD', marginBottom: '6px' }}>{DIM_LABELS[dim]}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {allTags.filter(t => t.dimension === dim).map(tag => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleEditTag(tag.id)}
                            style={{
                              fontSize: '11px', padding: '3px 10px', borderRadius: '999px', border: '1px solid',
                              backgroundColor: editTags.includes(tag.id) ? (tag.color || '#111') : 'transparent',
                              color: editTags.includes(tag.id) ? '#fff' : (tag.color || '#888'),
                              borderColor: tag.color || '#E0E0E0',
                              cursor: 'pointer', fontFamily: font,
                            }}
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
              <button onClick={() => setEditItem(null)} style={{ flex: 1, height: '40px', border: '1px solid #EBEBEB', background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: font }}>取消</button>
              <button onClick={handleSaveEdit} disabled={saving} style={{ flex: 1, height: '40px', background: '#111', color: '#fff', border: 'none', fontSize: '13px', cursor: 'pointer', fontFamily: font, opacity: saving ? 0.5 : 1 }}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', padding: '32px', width: '360px', fontFamily: font }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>确认删除？</h3>
            <p style={{ fontSize: '12px', color: '#BDBDBD', marginBottom: '24px' }}>此操作不可恢复。</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, height: '40px', border: '1px solid #EBEBEB', background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: font }}>取消</button>
              <button onClick={() => handleDelete(deleteId)} style={{ flex: 1, height: '40px', background: '#111', color: '#fff', border: 'none', fontSize: '13px', cursor: 'pointer', fontFamily: font }}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
