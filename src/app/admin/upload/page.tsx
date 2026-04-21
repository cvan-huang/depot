'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Tag } from '@/types'
import { cn } from '@/lib/utils'

type ItemStatus = 'uploading' | 'uploaded' | 'analyzing' | 'ready' | 'saving' | 'saved' | 'error'

interface UploadItem {
  id: string
  file: File
  preview: string
  supabaseUrl: string
  title: string
  description: string
  selectedTags: string[]
  status: ItemStatus
  error?: string
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.readAsDataURL(file)
  })
}

export default function UploadPage() {
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    import('@/lib/supabase/queries').then(({ getAllTags }) => {
      getAllTags().then(tags => setAllTags(tags))
    })
  }, [])

  const updateItem = useCallback((id: string, updates: Partial<UploadItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item))
  }, [])

  const addFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (!imageFiles.length) return

    const newItems: UploadItem[] = await Promise.all(imageFiles.map(async (file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      preview: await readFileAsDataURL(file),
      supabaseUrl: '',
      title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      description: '',
      selectedTags: [],
      status: 'uploading' as ItemStatus,
    })))

    setItems(prev => [...prev, ...newItems])

    // Upload all to Supabase concurrently
    const { uploadImage } = await import('@/lib/supabase/queries')
    await Promise.all(newItems.map(async (item) => {
      try {
        const url = await uploadImage(item.file)
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, supabaseUrl: url, status: 'uploaded' } : i))
      } catch (e: any) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: e.message } : i))
      }
    }))
  }, [])

  const analyzeItem = useCallback(async (item: UploadItem) => {
    if (!item.supabaseUrl) return
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'analyzing', error: undefined } : i))
    try {
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: item.supabaseUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const allTagNames = [...(data.scene || []), ...(data.style || []), ...(data.element || [])]
      const matchedIds = allTags.filter(t => allTagNames.includes(t.name)).map(t => t.id)
      setItems(prev => prev.map(i => i.id === item.id ? {
        ...i,
        status: 'ready',
        title: data.title || i.title,
        description: data.description || i.description,
        selectedTags: matchedIds,
      } : i))
    } catch (e: any) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploaded', error: e.message } : i))
    }
  }, [allTags])

  const analyzeAll = async () => {
    const targets = items.filter(i => i.status === 'uploaded' || i.status === 'ready')
    for (const item of targets) {
      await analyzeItem(item)
    }
  }

  const saveAll = async () => {
    const targets = items.filter(i => (i.status === 'ready' || i.status === 'uploaded') && i.title && i.supabaseUrl)
    if (!targets.length) return
    setSubmitting(true)
    const { createMaterial } = await import('@/lib/supabase/queries')
    for (const item of targets) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'saving' } : i))
      try {
        await createMaterial({
          title: item.title,
          description: item.description,
          image_url: item.supabaseUrl,
          source_url: '',
          source_platform: '',
          is_featured: false,
          tagIds: item.selectedTags,
        })
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'saved' } : i))
      } catch (e: any) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: e.message } : i))
      }
    }
    setSubmitting(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const uploadedCount = items.filter(i => i.status === 'uploaded' || i.status === 'ready').length
  const savableCount = items.filter(i => (i.status === 'ready' || i.status === 'uploaded') && i.title && i.supabaseUrl).length
  const savedCount = items.filter(i => i.status === 'saved').length

  return (
    <div>
      {/* Header */}
      <div className="border-bottom-heavy px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-4">
          <h1 className="heading-display text-3xl">UPLOAD</h1>
          {items.length > 0 && (
            <span className="nav-label text-[10px] text-[#808080]">
              {items.length} 张图片
              {savedCount > 0 && <span className="text-green-600 ml-2">· {savedCount} 已完成</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {uploadedCount > 0 && (
            <button
              onClick={analyzeAll}
              className="nav-label text-[10px] px-4 py-2 border-heavy bg-black text-white hover:bg-[#333] transition-colors flex items-center gap-2"
            >
              ✦ AI 分析全部 ({uploadedCount})
            </button>
          )}
          {savableCount > 0 && (
            <button
              onClick={saveAll}
              disabled={submitting}
              className="nav-label text-[10px] px-4 py-2 border-heavy bg-[#FF2442] text-white hover:bg-black transition-colors disabled:opacity-50"
            >
              {submitting ? '保存中...' : `确认保存全部 (${savableCount}) →`}
            </button>
          )}
        </div>
      </div>

      {/* Drop Zone */}
      <div className="px-6 pt-4">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-heavy border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center gap-2',
            items.length > 0 ? 'h-16' : 'h-44',
            dragOver ? 'bg-[#FFF0F3] border-[#FF2442]' : 'hover:bg-[#F8F8F8]'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={e => addFiles(Array.from(e.target.files || []))}
            className="hidden"
          />
          {items.length > 0 ? (
            <p className="nav-label text-[10px] text-[#BDBDBD]">+ 继续添加图片</p>
          ) : (
            <>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-[#BDBDBD]">
                <path d="M16 6V22M16 6L10 12M16 6L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 26V28H28V26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p className="nav-label text-[10px] text-[#808080]">拖入图片 · 支持批量</p>
              <p className="nav-label text-[9px] text-[#BDBDBD]">JPG · PNG · WEBP · 可同时拖入多张</p>
            </>
          )}
        </div>
      </div>

      {/* Items Grid */}
      {items.length > 0 && (
        <div className="px-6 py-4 grid grid-cols-2 gap-3">
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              allTags={allTags}
              onUpdate={(updates) => updateItem(item.id, updates)}
              onRemove={() => setItems(prev => prev.filter(i => i.id !== item.id))}
              onToggleTag={(tagId) => {
                setItems(prev => prev.map(i => {
                  if (i.id !== item.id) return i
                  const sel = i.selectedTags.includes(tagId)
                    ? i.selectedTags.filter(t => t !== tagId)
                    : [...i.selectedTags, tagId]
                  return { ...i, selectedTags: sel }
                }))
              }}
              onAnalyze={() => analyzeItem(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemCard({
  item,
  allTags,
  onUpdate,
  onRemove,
  onToggleTag,
  onAnalyze,
}: {
  item: UploadItem
  allTags: Tag[]
  onUpdate: (u: Partial<UploadItem>) => void
  onRemove: () => void
  onToggleTag: (id: string) => void
  onAnalyze: () => void
}) {
  const STATUS = {
    uploading: { label: '上传中...', cls: 'text-yellow-500' },
    uploaded:  { label: '✓ 已上传', cls: 'text-blue-500' },
    analyzing: { label: 'AI 识别中...', cls: 'text-purple-500' },
    ready:     { label: '✦ AI 已识别', cls: 'text-green-600' },
    saving:    { label: '保存中...', cls: 'text-yellow-500' },
    saved:     { label: '✓ 已完成', cls: 'text-green-700' },
    error:     { label: '✗ 错误', cls: 'text-red-500' },
  }
  const s = STATUS[item.status]
  const isDone = item.status === 'saved'

  return (
    <div className={cn('border-heavy overflow-hidden', isDone && 'opacity-50')}>
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#F8F8F8] border-b border-black/10">
        <span className={cn('nav-label text-[9px] flex items-center gap-1', s.cls)}>
          {s.label}
          {item.status === 'analyzing' && (
            <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
          )}
        </span>
        <div className="flex items-center gap-2">
          {(item.status === 'uploaded' || item.status === 'ready') && (
            <button onClick={onAnalyze} className="nav-label text-[9px] text-blue-500 hover:text-black transition-colors">
              ✦ AI
            </button>
          )}
          {!isDone && (
            <button onClick={onRemove} className="nav-label text-[9px] text-[#BDBDBD] hover:text-red-500 transition-colors">✕</button>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="flex">
        {/* Thumbnail */}
        <div className="w-28 h-28 flex-shrink-0 border-r border-black/10 overflow-hidden bg-[#F0F0F0]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.preview} alt="" className="w-full h-full object-cover" />
          {item.status === 'uploading' && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <span className="inline-block w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="flex-1 p-2 space-y-1.5 min-w-0">
          <input
            value={item.title}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="标题 *"
            className="w-full h-7 px-2 border-heavy text-[11px] focus:outline-none focus:bg-[#F8F8F8] bg-white"
          />
          <input
            value={item.description}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="描述（可选）"
            className="w-full h-7 px-2 border-heavy text-[11px] focus:outline-none focus:bg-[#F8F8F8] bg-white"
          />
          {/* Tags */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {allTags.map(tag => {
              const active = item.selectedTags.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onToggleTag(tag.id)}
                  className="nav-label text-[8px] px-1.5 py-0.5 border transition-all"
                  style={{
                    backgroundColor: active ? (tag.color || '#000') : 'transparent',
                    color: active ? '#fff' : (tag.color || '#555'),
                    borderColor: tag.color || '#555',
                  }}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
          {item.error && (
            <p className="nav-label text-[8px] text-red-500 truncate" title={item.error}>{item.error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
