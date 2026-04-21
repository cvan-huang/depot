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
  const [editForm, setEditForm] = useState({ title: '', description: '', source_url: '', source_platform: '' })
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

  const openEdit = (m: MaterialWithTags) => {
    setEditItem(m)
    setEditForm({ title: m.title, description: m.description || '', source_url: m.source_url || '', source_platform: m.source_platform || '' })
    setEditTags((m.tags || []).map(t => t.id))
  }

  const toggleEditTag = (tagId: string) => {
    setEditTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId])
  }

  const handleSaveEdit = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      const { updateMaterial, updateMaterialTags, getAllTags: _gt } = await import('@/lib/supabase/queries')
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

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(m => m.id)))
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">管理素材</h1>
          <p className="text-sm text-[#8C8C8C] mt-1">
            {loading ? '加载中...' : `共 ${materials.length} 个素材`}
            {selected.size > 0 && (
              <span className="ml-2 text-[#FF2442] font-medium">· 已选 {selected.size} 个</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <button
              onClick={() => setShowBulkConfirm(true)}
              disabled={bulkDeleting}
              className="h-9 px-4 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {bulkDeleting ? '删除中...' : `删除所选 (${selected.size})`}
            </button>
          )}
          <div className="relative">
            <input
              type="text"
              placeholder="搜索素材..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 pl-9 pr-3 rounded-xl border border-[#EBEBEB] bg-[#F5F5F5] text-sm placeholder:text-[#BDBDBD] focus:outline-none focus:border-[#FF2442] transition-colors w-52"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BDBDBD]" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="5.5" cy="5.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#EBEBEB] overflow-hidden">
        <div className="grid grid-cols-[32px_80px_1fr_200px_80px_100px] items-center gap-4 px-4 py-3 border-b border-[#EBEBEB]">
          <input
            type="checkbox"
            checked={filtered.length > 0 && selected.size === filtered.length}
            onChange={toggleSelectAll}
            className="w-4 h-4 cursor-pointer accent-[#FF2442]"
          />
          <span className="text-xs text-[#8C8C8C] font-medium">封面</span>
          <span className="text-xs text-[#8C8C8C] font-medium">标题</span>
          <span className="text-xs text-[#8C8C8C] font-medium">标签</span>
          <span className="text-xs text-[#8C8C8C] font-medium">状态</span>
          <span className="text-xs text-[#8C8C8C] font-medium">操作</span>
        </div>

        {loading && (
          <div className="py-12 text-center text-[#8C8C8C] text-sm">加载中...</div>
        )}

        {!loading && filtered.map(m => (
          <div
            key={m.id}
            className={cn(
              'grid grid-cols-[32px_80px_1fr_200px_80px_100px] items-center gap-4 px-4 py-3 border-b border-[#EBEBEB] last:border-0 transition-colors',
              selected.has(m.id) ? 'bg-[#FFF5F6]' : 'hover:bg-[#FAFAFA]'
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(m.id)}
              onChange={() => toggleSelect(m.id)}
              className="w-4 h-4 cursor-pointer accent-[#FF2442]"
            />
            <div className="w-16 h-12 rounded-xl overflow-hidden bg-[#F5F5F5] shrink-0">
              <Image
                src={m.image_url}
                alt={m.title}
                width={64}
                height={48}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>

            <div>
              <p className="text-sm font-medium text-[#1A1A1A] line-clamp-1">{m.title}</p>
              {m.description && (
                <p className="text-xs text-[#8C8C8C] line-clamp-1 mt-0.5">{m.description}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              {(m.tags || []).slice(0, 3).map(t => (
                <span
                  key={t.id}
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: t.color ? `${t.color}22` : '#F5F5F5', color: t.color || '#666' }}
                >
                  {t.name}
                </span>
              ))}
              {(m.tags || []).length === 0 && (
                <span className="text-[10px] text-[#BDBDBD]">无标签</span>
              )}
            </div>

            <button
              onClick={() => handleToggleFeatured(m.id, m.is_featured)}
              className={cn(
                'text-[10px] px-2 py-1 rounded-full font-medium transition-all',
                m.is_featured
                  ? 'bg-[#FFF0F2] text-[#FF2442]'
                  : 'bg-[#F5F5F5] text-[#8C8C8C] hover:bg-[#FFF0F2] hover:text-[#FF2442]'
              )}
            >
              {m.is_featured ? '精选 ✓' : '普通'}
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => openEdit(m)}
                className="text-xs text-[#8C8C8C] hover:text-black transition-colors"
              >
                编辑
              </button>
              <button
                onClick={() => setDeleteId(m.id)}
                className="text-xs text-[#8C8C8C] hover:text-red-500 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-[#8C8C8C] text-sm">
            {materials.length === 0 ? '暂无素材，去上传吧' : '没有找到匹配的素材'}
          </div>
        )}
      </div>

      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#1A1A1A] mb-2">批量删除 {selected.size} 个素材？</h3>
            <p className="text-sm text-[#8C8C8C] mb-5">此操作不可恢复，所有选中的素材将被永久删除。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkConfirm(false)}
                className="flex-1 h-10 rounded-xl border border-[#EBEBEB] text-sm text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                确认全部删除
              </button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#1A1A1A] mb-4">编辑素材</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#8C8C8C] block mb-1">标题</label>
                <input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF2442]" />
              </div>
              <div>
                <label className="text-xs text-[#8C8C8C] block mb-1">描述</label>
                <textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-lg border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF2442] resize-none" />
              </div>
              <div>
                <label className="text-xs text-[#8C8C8C] block mb-1">来源链接</label>
                <input value={editForm.source_url} onChange={e => setEditForm(p => ({ ...p, source_url: e.target.value }))}
                  placeholder="https://..." className="w-full h-9 px-3 rounded-lg border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF2442]" />
              </div>
              <div>
                <label className="text-xs text-[#8C8C8C] block mb-2">标签</label>
                <div className="space-y-2">
                  {(['scene', 'style', 'element'] as const).map(dim => (
                    <div key={dim}>
                      <p className="text-[10px] text-[#BDBDBD] mb-1">{DIM_LABELS[dim]}</p>
                      <div className="flex flex-wrap gap-1">
                        {allTags.filter(t => t.dimension === dim).map(tag => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleEditTag(tag.id)}
                            className="text-[11px] px-2 py-0.5 rounded-full border transition-all"
                            style={{
                              backgroundColor: editTags.includes(tag.id) ? (tag.color || '#000') : 'transparent',
                              color: editTags.includes(tag.id) ? '#fff' : (tag.color || '#666'),
                              borderColor: tag.color || '#ccc',
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

              <div>
                <label className="text-xs text-[#8C8C8C] block mb-1">来源平台</label>
                <div className="flex gap-2">
                  {['小红书', 'Pinterest', 'Instagram'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, source_platform: prev.source_platform === p ? '' : p }))}
                      className={cn(
                        'flex-1 h-9 rounded-lg border text-sm transition-colors',
                        editForm.source_platform === p
                          ? 'bg-black text-white border-black'
                          : 'border-[#EBEBEB] text-[#8C8C8C] hover:border-black hover:text-black'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditItem(null)}
                className="flex-1 h-10 rounded-xl border border-[#EBEBEB] text-sm text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors">
                取消
              </button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="flex-1 h-10 rounded-xl bg-black text-white text-sm font-semibold hover:bg-[#333] transition-colors disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#1A1A1A] mb-2">确认删除？</h3>
            <p className="text-sm text-[#8C8C8C] mb-5">此操作不可恢复，素材将被永久删除。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 h-10 rounded-xl border border-[#EBEBEB] text-sm text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
