'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { FolderKanban, UserRound } from 'lucide-react'
import { AnalyzeImageResult, Project, Tag, TagSuggestion } from '@/types'
import { cn } from '@/lib/utils'

type ItemStatus = 'uploading' | 'uploaded' | 'analyzing' | 'ready' | 'saving' | 'saved' | 'error'
type MediaType = 'image' | 'video' | 'gif'
type UploadMode = 'personal' | 'project'
type QueueFilter = 'active' | 'all' | 'saved' | 'error'

interface UploadItem {
  id: string
  file: File
  preview: string
  mediaType: MediaType
  supabaseUrl: string
  title: string
  description: string
  source_url: string
  source_platform: string
  selectedTags: Tag[]
  newTagCandidates: TagSuggestion[]
  status: ItemStatus
  hash?: string
  error?: string
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return '操作失败'
}

function isMissingProjectSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const value = error as { code?: unknown; message?: unknown }
  return (
    value.code === 'PGRST205' ||
    (typeof value.message === 'string' && value.message.includes('projects'))
  )
}

function uniqueTagSuggestions(suggestions: TagSuggestion[]) {
  const seen = new Set<string>()
  return suggestions.filter(tag => {
    const key = tag.name.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function findTagsByNames(tags: Tag[], names: string[]) {
  const byName = new Map(tags.map(tag => [tag.name.toLowerCase(), tag]))
  const seen = new Set<string>()

  return names
    .map(name => byName.get(name.trim().toLowerCase()))
    .filter((tag): tag is Tag => Boolean(tag))
    .filter(tag => {
      if (seen.has(tag.id)) return false
      seen.add(tag.id)
      return true
    })
}

function mergeTags(current: Tag[], incoming: Tag[]) {
  const ids = new Set(current.map(tag => tag.id))
  return [...current, ...incoming.filter(tag => !ids.has(tag.id))]
}

function getMediaType(file: File): MediaType {
  if (file.type === 'video/mp4' || file.type === 'video/quicktime') return 'video'
  if (file.type === 'image/gif') return 'gif'
  return 'image'
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.readAsDataURL(file)
  })
}

async function calcFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Extract a frame from a video file as base64 JPEG (for AI analysis)
function extractVideoFrame(file: File, seekSecs = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(seekSecs, video.duration * 0.1)
    }

    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.min(video.videoWidth, 512)
      canvas.height = Math.round(video.videoHeight * (canvas.width / video.videoWidth))
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }

    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('视频帧提取失败')) }
    video.src = url
  })
}

export default function UploadPage() {
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadMode, setUploadMode] = useState<UploadMode>('personal')
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('active')
  const [globalAuthor, setGlobalAuthor] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [projectName, setProjectName] = useState('')
  const [projectSchemaMissing, setProjectSchemaMissing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    import('@/lib/supabase/queries').then(({ getProjects }) => {
      getProjects()
        .then(projectData => {
          setProjects(projectData)
          setProjectSchemaMissing(false)
        })
        .catch((error: unknown) => {
          if (isMissingProjectSchemaError(error)) setProjectSchemaMissing(true)
        })
    })
  }, [])

  const analyzeItem = useCallback(async (item: UploadItem) => {
    if (!item.supabaseUrl) return
    setItems(prev => prev.map(i => i.id === item.id ? {
      ...i,
      status: 'analyzing',
      error: undefined,
      newTagCandidates: [],
    } : i))

    const { getAllTags } = await import('@/lib/supabase/queries')

    try {
      const allTags = await getAllTags()

      // Always send image as base64 from client (avoids Vercel → Supabase fetch failures)
      const body = item.mediaType === 'video'
        ? { imageBase64: await extractVideoFrame(item.file) }
        : { imageBase64: await readFileAsDataURL(item.file) }

      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as AnalyzeImageResult & { tags?: string[]; error?: string }
      if (!res.ok) throw new Error(data.error)

      // Auto-prepend "动态" for GIF and MP4, reusing an existing tag when possible.
      const tagNames = [...(data.matchedTags || data.tags || [])]
      const candidates = [...(data.newTagCandidates || [])]
      if (item.mediaType === 'video' || item.mediaType === 'gif' || data._animated) {
        const hasDynamic = tagNames.some(name => name.trim().toLowerCase() === '动态')
        const dynamicTag = allTags.find(tag => tag.name === '动态')
        if (!hasDynamic && dynamicTag) tagNames.unshift(dynamicTag.name)
        if (!hasDynamic && !dynamicTag) candidates.unshift({ name: '动态', dimension: 'element' })
      }

      const matchedTags = findTagsByNames(allTags, tagNames)
      const existingNames = new Set(allTags.map(tag => tag.name.toLowerCase()))
      const selectedNames = new Set(matchedTags.map(tag => tag.name.toLowerCase()))
      const newTagCandidates = uniqueTagSuggestions(candidates)
        .filter(tag => !existingNames.has(tag.name.toLowerCase()))
        .filter(tag => !selectedNames.has(tag.name.toLowerCase()))

      setItems(prev => prev.map(i => i.id === item.id ? {
        ...i,
        status: 'ready',
        title: data.title || i.title,
        description: data.description || i.description,
        selectedTags: mergeTags(i.selectedTags, matchedTags),
        newTagCandidates,
      } : i))
    } catch (e: unknown) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploaded', error: getErrorMessage(e) } : i))
    }
  }, [])

  const addFiles = useCallback(async (files: File[]) => {
    const mediaFiles = files.filter(f =>
      f.type.startsWith('image/') || f.type === 'video/mp4' || f.type === 'video/quicktime'
    )
    if (!mediaFiles.length) return

    // 1. Calculate all hashes upfront
    const hashes = await Promise.all(mediaFiles.map(f => calcFileHash(f)))

    // 2. Check each hash against DB and within current batch before showing any item
    const { uploadImage, findMaterialByHash } = await import('@/lib/supabase/queries')
    const seenHashes = new Set<string>()
    const validFiles: Array<{ file: File; hash: string; preview: string; mediaType: MediaType }> = []
    const skippedCount = { n: 0 }

    for (let idx = 0; idx < mediaFiles.length; idx++) {
      const file = mediaFiles[idx]
      const hash = hashes[idx]

      // Deduplicate within this drag batch
      if (seenHashes.has(hash)) {
        skippedCount.n++
        continue
      }
      seenHashes.add(hash)

      // Deduplicate against DB
      let isDup = false
      try {
        isDup = await findMaterialByHash(hash)
        console.log(`[Dedup] hash=${hash.slice(0, 8)}... isDup=${isDup}`)
      } catch (e) {
        console.warn('[Dedup] check failed, allowing upload:', e)
      }
      if (isDup) {
        skippedCount.n++
        continue
      }

      const mediaType = getMediaType(file)
      // Use object URL for video (faster), data URL for image/gif
      const preview = mediaType === 'video'
        ? URL.createObjectURL(file)
        : await readFileAsDataURL(file)
      validFiles.push({ file, hash, preview, mediaType })
    }

    if (skippedCount.n > 0) {
      alert(`已自动跳过 ${skippedCount.n} 张重复素材`)
    }
    if (!validFiles.length) return

    // 3. Add only non-duplicate items to the list
    const newItems: UploadItem[] = validFiles.map(({ file, hash, preview, mediaType }) => ({
      id: Math.random().toString(36).slice(2),
      file,
      preview,
      supabaseUrl: '',
      mediaType,
      title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      description: '',
      source_url: '',
      source_platform: '',
      selectedTags: [],
      newTagCandidates: [],
      status: 'uploading' as ItemStatus,
      hash,
    }))

    setItems(prev => {
      // Also deduplicate against already-queued items in state
      const existingHashes = new Set(prev.map(i => i.hash).filter(Boolean))
      const filtered = newItems.filter(i => !existingHashes.has(i.hash))
      return [...prev, ...filtered]
    })

    // 4. Upload each valid file (pass hash so Qiniu uses it as key → deterministic URL)
    await Promise.all(newItems.map(async (item) => {
      try {
        const url = await uploadImage(item.file, item.hash)
        const uploaded: UploadItem = { ...item, supabaseUrl: url, status: 'uploaded' }
        setItems(prev => prev.map(i => i.id === item.id ? uploaded : i))
        await analyzeItem(uploaded)
      } catch (e: unknown) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: getErrorMessage(e) } : i))
      }
    }))
  }, [analyzeItem])

  const saveAll = async () => {
    const targets = items.filter(i => (i.status === 'ready' || i.status === 'uploaded' || i.status === 'error') && i.title && i.supabaseUrl)
    if (!targets.length) return

    if (uploadMode === 'project' && !projectName.trim()) {
      setItems(prev => prev.map(i => targets.some(t => t.id === i.id) ? { ...i, status: 'error', error: '请输入或选择项目' } : i))
      return
    }

    setSubmitting(true)
    const projectId = await ensureProjectId(targets)
    if (projectId === false) {
      setSubmitting(false)
      return
    }

    for (const item of targets) {
      await saveItem(item, projectId)
    }
    setSubmitting(false)
  }

  const ensureProjectId = async (targets: UploadItem[]): Promise<string | undefined | false> => {
    const { getOrCreateProject, getProjects } = await import('@/lib/supabase/queries')

    try {
      if (uploadMode === 'project' && projectName.trim()) {
        const project = await getOrCreateProject(projectName)
        const projectId = project.id
        setProjectName(project.name)
        setProjects(await getProjects())
        setProjectSchemaMissing(false)
        return projectId
      }
    } catch (e: unknown) {
      const message = isMissingProjectSchemaError(e)
        ? '项目表还没有创建，请先在 Supabase 执行 supabase/add-projects.sql'
        : getErrorMessage(e)
      if (isMissingProjectSchemaError(e)) setProjectSchemaMissing(true)
      setItems(prev => prev.map(i => targets.some(t => t.id === i.id) ? { ...i, status: 'error', error: message } : i))
      return false
    }

    return undefined
  }

  const saveItem = async (item: UploadItem, projectId?: string) => {
    const { createMaterial } = await import('@/lib/supabase/queries')
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'saving', error: undefined } : i))
    try {
      await createMaterial({
        title: item.title,
        description: item.description,
        image_url: item.supabaseUrl,
        source_url: item.source_url,
        source_platform: item.source_platform,
        author: globalAuthor.trim() || undefined,
        image_hash: item.hash,
        project_id: projectId,
        is_featured: false,
        tagIds: item.selectedTags.map(t => t.id),
      })
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'saved' } : i))
    } catch (e: unknown) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: getErrorMessage(e) } : i))
    }
  }

  const saveSingle = async (item: UploadItem) => {
    if (!item.title || !item.supabaseUrl || item.status === 'saving' || item.status === 'saved') return

    if (uploadMode === 'project' && !projectName.trim()) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: '请输入或选择项目' } : i))
      return
    }

    setSubmitting(true)
    const projectId = await ensureProjectId([item])
    if (projectId !== false) await saveItem(item, projectId)
    setSubmitting(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const savableCount = items.filter(i => (i.status === 'ready' || i.status === 'uploaded' || i.status === 'error') && i.title && i.supabaseUrl).length
  const savedCount = items.filter(i => i.status === 'saved').length
  const errorCount = items.filter(i => i.status === 'error').length
  const canSave = savableCount > 0 && (uploadMode === 'personal' || Boolean(projectName.trim()))
  const matchedProject = projects.find(project => project.name.trim().toLowerCase() === projectName.trim().toLowerCase())
  const projectHint = uploadMode === 'project'
    ? projectSchemaMissing
      ? '项目表还没有创建'
      : projectName.trim()
        ? matchedProject
          ? `将添加到已有项目：${matchedProject.name}`
          : `将创建新项目：${projectName.trim()}`
        : '填写项目名后，这批素材会归档到项目页'
    : ''
  const visibleItems = items.filter(item => {
    if (queueFilter === 'all') return true
    if (queueFilter === 'saved') return item.status === 'saved'
    if (queueFilter === 'error') return item.status === 'error'
    return item.status !== 'saved'
  })

  return (
    <div>
      {/* Header */}
      <div className="upload-sticky-header flex items-center justify-between sticky top-0 bg-white z-10"
        style={{ padding: '20px 48px' }}>
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
          {savedCount > 0 && (
            <button
              type="button"
              onClick={() => setItems(prev => prev.filter(item => item.status !== 'saved'))}
              className="nav-label text-[10px] px-3 py-2 border border-[#EBEBEB] text-[#808080] hover:border-[#111] hover:text-[#111] transition-colors"
            >
              清空已完成
            </button>
          )}
          {savableCount > 0 && (
            <button
              onClick={saveAll}
              disabled={submitting || !canSave}
              className="nav-label text-[10px] px-4 py-2 border border-[#111] bg-[#111] text-white hover:bg-[#FF2442] hover:border-[#FF2442] transition-colors disabled:opacity-50"
            >
              {submitting ? '保存中...' : canSave ? `确认保存全部 (${savableCount}) →` : '填写项目后保存'}
            </button>
          )}
        </div>
      </div>

      {/* Upload mode */}
      <div className="admin-pad" style={{ padding: '10px 48px 0' }}>
        <div className="upload-mode-grid grid grid-cols-2 gap-3">
          {([
            { value: 'personal' as const, label: '个人素材上传', Icon: UserRound },
            { value: 'project' as const, label: '项目素材上传', Icon: FolderKanban },
          ]).map(({ value, label, Icon }) => {
            const active = uploadMode === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setUploadMode(value)}
                className={cn(
                  'h-16 border flex flex-col items-center justify-center gap-1 transition-colors',
                  active ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#BDBDBD] border-[#EBEBEB] hover:text-[#111] hover:border-[#111]'
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} strokeWidth={1.8} />
                  <span className="nav-label text-[10px]">{label}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Project + Global Author Input */}
      <div className="admin-pad" style={{ padding: '10px 48px' }}>
        <div className={cn('upload-meta-grid grid gap-3', uploadMode === 'project' ? 'grid-cols-2' : 'grid-cols-1')}>
          {uploadMode === 'project' && (
            <div className="flex items-center gap-3 border border-[#EBEBEB] bg-[#FAFAFA]"
              style={{ padding: '10px 14px' }}>
              <span className="nav-label text-[10px] text-[#BDBDBD] whitespace-nowrap">项目</span>
              <input
                type="text"
                value={projectName}
                list="project-options"
                onChange={e => setProjectName(e.target.value)}
                placeholder="选择已有项目 / 输入新项目名"
                className="flex-1 bg-transparent text-[11px] focus:outline-none placeholder:text-[#DCDCDC]"
              />
              <datalist id="project-options">
                {projects.map(project => (
                  <option key={project.id} value={project.name} />
                ))}
              </datalist>
              {projectSchemaMissing && (
                <span className="text-[10px] text-[#FF2442] whitespace-nowrap">
                  需先建 projects 表
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 border border-[#BDBDBD] bg-white shadow-[inset_0_0_0_1px_#F3F3F3]"
            style={{ padding: '12px 14px' }}>
            <span className="nav-label text-[10px] text-[#111] whitespace-nowrap">由 TA 推荐</span>
            <input
              type="text"
              value={globalAuthor}
              onChange={e => setGlobalAuthor(e.target.value)}
              placeholder="设计师姓名 / 来源账号（可选，批量上传时统一署名）"
              className="flex-1 bg-transparent text-[12px] focus:outline-none placeholder:text-[#A8A8A8]"
            />
          </div>
        </div>
        {uploadMode === 'project' && (
          <div className={cn(
            'mt-2 border px-3 py-2 text-[11px]',
            projectSchemaMissing ? 'border-[#FF2442] text-[#FF2442] bg-[#FFF0F3]' : 'border-[#EBEBEB] text-[#808080] bg-[#FAFAFA]'
          )}>
            {projectHint}
          </div>
        )}
      </div>

      {/* Drop Zone */}
      <div className="admin-pad" style={{ padding: '0 48px' }}>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border border-dashed border-[#DCDCDC] cursor-pointer transition-colors flex flex-col items-center justify-center gap-2',
            items.length > 0 ? 'h-16' : 'h-44',
            dragOver ? 'bg-[#FFF0F3] border-[#FF2442]' : 'hover:bg-[#F8F8F8]'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,.mp4,.gif"
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
              <p className="nav-label text-[9px] text-[#BDBDBD]">JPG · PNG · WEBP · GIF · MP4 · 可同时拖入多张</p>
            </>
          )}
        </div>
      </div>

      {/* Items Grid */}
      {items.length > 0 && (
        <div className="admin-pad" style={{ padding: '18px 48px 24px' }}>
          <div className="upload-filter-bar flex items-center justify-between mb-4">
            <div className="flex items-center gap-1 flex-wrap">
              {([
                { value: 'active' as const, label: `待处理 ${items.length - savedCount}` },
                { value: 'all' as const, label: `全部 ${items.length}` },
                { value: 'saved' as const, label: `已完成 ${savedCount}` },
                { value: 'error' as const, label: `错误 ${errorCount}` },
              ]).map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setQueueFilter(option.value)}
                  className={cn(
                    'nav-label text-[9px] px-3 py-2 border transition-colors',
                    queueFilter === option.value
                      ? 'bg-[#111] text-white border-[#111]'
                      : 'bg-white text-[#BDBDBD] border-[#EBEBEB] hover:text-[#111] hover:border-[#111]'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {errorCount > 0 && (
              <button
                type="button"
                onClick={() => setItems(prev => prev.map(item => item.status === 'error' ? { ...item, status: item.supabaseUrl ? 'uploaded' : 'error', error: undefined } : item))}
                className="nav-label text-[9px] px-3 py-2 border border-[#EBEBEB] text-[#808080] hover:text-[#111] hover:border-[#111] transition-colors"
              >
                清除错误提示
              </button>
            )}
          </div>
          {visibleItems.length === 0 ? (
            <div className="border border-[#EBEBEB] py-12 text-center text-[12px] text-[#BDBDBD]">
              当前筛选没有素材
            </div>
          ) : (
            <div className="upload-items-grid grid grid-cols-2 gap-4">
              {visibleItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  saveDisabled={submitting || !item.title || !item.supabaseUrl || item.status === 'saving' || item.status === 'saved' || (uploadMode === 'project' && !projectName.trim())}
                  onSave={() => saveSingle(item)}
                  onUpdate={(updates) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updates } : i))}
                  onRemove={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                  onRemoveTag={(tagId) => setItems(prev => prev.map(i =>
                    i.id === item.id ? { ...i, selectedTags: i.selectedTags.filter(t => t.id !== tagId) } : i
                  ))}
                  onAddTag={(tag) => setItems(prev => prev.map(i =>
                    i.id === item.id && !i.selectedTags.find(t => t.id === tag.id)
                      ? { ...i, selectedTags: [...i.selectedTags, tag] }
                      : i
                  ))}
                  onRemoveCandidate={(name) => setItems(prev => prev.map(i =>
                    i.id === item.id
                      ? { ...i, newTagCandidates: i.newTagCandidates.filter(tag => tag.name !== name) }
                      : i
                  ))}
                  onReanalyze={() => analyzeItem(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemCard({
  item,
  saveDisabled,
  onSave,
  onUpdate,
  onRemove,
  onRemoveTag,
  onAddTag,
  onRemoveCandidate,
  onReanalyze,
}: {
  item: UploadItem
  saveDisabled: boolean
  onSave: () => void
  onUpdate: (u: Partial<UploadItem>) => void
  onRemove: () => void
  onRemoveTag: (tagId: string) => void
  onAddTag: (tag: Tag) => void
  onRemoveCandidate: (name: string) => void
  onReanalyze: () => void
}) {
  const [tagInput, setTagInput] = useState('')
  const [tagLoading, setTagLoading] = useState(false)

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

  const handleAddTag = async () => {
    const name = tagInput.trim()
    if (!name || tagLoading) return
    setTagLoading(true)
    try {
      const { getOrCreateTag } = await import('@/lib/supabase/queries')
      const tag = await getOrCreateTag(name)
      onAddTag(tag)
      setTagInput('')
    } catch (e) {
      console.error(e)
    }
    setTagLoading(false)
  }

  const handleConfirmCandidate = async (candidate: TagSuggestion) => {
    if (tagLoading) return
    setTagLoading(true)
    try {
      const { getOrCreateTag } = await import('@/lib/supabase/queries')
      const tag = await getOrCreateTag(candidate.name, candidate.dimension || 'element')
      onAddTag(tag)
      onRemoveCandidate(candidate.name)
    } catch (e) {
      console.error(e)
    }
    setTagLoading(false)
  }

  return (
    <div className={cn('border border-[#EBEBEB] overflow-hidden', isDone && 'opacity-50')}>
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#FAFAFA] border-b border-[#EBEBEB]">
        <span className={cn('nav-label text-[9px] flex items-center gap-1', s.cls)}>
          {s.label}
          {item.status === 'analyzing' && (
            <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
          )}
        </span>
        {!isDone && (
          <div className="flex items-center gap-2">
            {item.supabaseUrl && item.status !== 'uploading' && (
              <button
                type="button"
                onClick={onSave}
                disabled={saveDisabled}
                className="nav-label text-[9px] text-[#BDBDBD] hover:text-[#FF2442] transition-colors disabled:opacity-40"
              >
                保存
              </button>
            )}
            {item.supabaseUrl && item.status !== 'uploading' && item.status !== 'saving' && (
              <button
                type="button"
                onClick={onReanalyze}
                disabled={item.status === 'analyzing'}
                className="nav-label text-[9px] text-[#BDBDBD] hover:text-black transition-colors disabled:opacity-40"
              >
                重新识别
              </button>
            )}
            <button onClick={onRemove} className="nav-label text-[9px] text-[#BDBDBD] hover:text-red-500 transition-colors">✕</button>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="upload-item-body flex">
        {/* Thumbnail */}
        <div className="upload-item-thumb w-28 flex-shrink-0 border-r border-[#EBEBEB] overflow-hidden bg-[#F5F5F5]" style={{ minHeight: '112px' }}>
          {item.mediaType === 'video' ? (
            <video
              src={item.preview}
              muted
              autoPlay
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.preview} alt="" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Fields */}
        <div className="flex-1 p-2 space-y-1.5 min-w-0">
          <input
            value={item.title}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="标题 *"
            className="w-full h-7 px-2 border border-[#EBEBEB] text-[11px] focus:outline-none focus:bg-[#FAFAFA] bg-white"
          />
          <input
            value={item.description}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="描述（可选）"
            className="w-full h-7 px-2 border border-[#EBEBEB] text-[11px] focus:outline-none focus:bg-[#FAFAFA] bg-white"
          />
          <div className="upload-source-row flex gap-1.5">
            <input
              value={item.source_url}
              onChange={e => onUpdate({ source_url: e.target.value })}
              placeholder="来源链接（可选）"
              className="flex-1 h-7 px-2 border border-[#EBEBEB] text-[11px] focus:outline-none focus:bg-[#FAFAFA] bg-white"
            />
            <div className="upload-platforms flex gap-1">
              {['小红书', 'Pinterest', 'Instagram'].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onUpdate({ source_platform: item.source_platform === p ? '' : p })}
                  className={cn(
                    'h-7 px-1.5 border text-[9px] transition-colors whitespace-nowrap',
                    item.source_platform === p ? 'bg-black text-white border-black' : 'border-current text-[#aaa] hover:border-black hover:text-black'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-0.5">
            <div className="flex flex-wrap gap-1">
              {item.selectedTags.length > 0 && (
                <span className="nav-label text-[8px] text-[#BDBDBD] mr-1">已选</span>
              )}
              {item.selectedTags.map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}22` : '#F0F0F0',
                    color: tag.color || '#555',
                  }}
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag.id)}
                    className="opacity-50 hover:opacity-100 transition-opacity leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}

              {!isDone && (
                <div className="inline-flex items-center border border-dashed border-[#CCC] rounded-full px-2 py-0.5 gap-1">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    placeholder="+ 添加标签"
                    className="text-[10px] w-16 bg-transparent focus:outline-none placeholder:text-[#CCC] text-[#555]"
                  />
                  {tagInput.trim() && (
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={tagLoading}
                      className="text-[9px] text-[#888] hover:text-black transition-colors disabled:opacity-50"
                    >
                      {tagLoading ? '...' : '↵'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {item.newTagCandidates.length > 0 && !isDone && (
            <div className="flex flex-wrap gap-1 pt-1 border-t border-[#F5F5F5] mt-1">
              <span className="nav-label text-[8px] text-[#BDBDBD] mr-1">AI 新标签</span>
              {item.newTagCandidates.map(candidate => (
                <button
                  key={`${candidate.name}-${candidate.dimension || 'element'}`}
                  type="button"
                  onClick={() => handleConfirmCandidate(candidate)}
                  disabled={tagLoading}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-[#FF2442] text-[#FF2442] hover:bg-[#FF2442] hover:text-white transition-colors disabled:opacity-50"
                  title="点击确认并创建新标签"
                >
                  + {candidate.name}
                </button>
              ))}
            </div>
          )}

          {item.error && (
            <div className="border border-[#FFE0E5] bg-[#FFF7F8] px-2 py-1">
              <p className="nav-label text-[8px] text-red-500 truncate" title={item.error}>{item.error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
