import { createClient } from './client'
import { MaterialPageResult, MaterialWithTags, Project, Tag, TagDimension } from '@/types'

type MaterialTagJoin = { tag: Tag | null }
type MaterialProjectRow = Omit<MaterialWithTags, 'tags' | 'project'> & {
  tags?: MaterialTagJoin[]
  project?: Project | null
}

function flattenMaterialRows(rows: MaterialProjectRow[] | null): MaterialWithTags[] {
  return (rows || []).map((m) => ({
    ...m,
    tags: (m.tags || []).map(t => t.tag).filter((tag): tag is Tag => Boolean(tag)),
    project: m.project || null,
  }))
}

function slugifyProjectName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return slug || `project-${Date.now()}`
}

function isMissingProjectSchema(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
    (error.code === 'PGRST200' ||
      error.code === 'PGRST205' ||
      error.message?.includes('projects') ||
      error.message?.includes('project_id'))
  )
}

function getProjectLookupCandidates(value: string) {
  const candidates = new Set([value])
  try {
    candidates.add(decodeURIComponent(value))
  } catch {
    // Keep the original value if it is not URI encoded.
  }
  return Array.from(candidates).map(candidate => candidate.trim()).filter(Boolean)
}

export async function getAllTags(): Promise<Tag[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('dimension')
    .order('name')

  if (error) { console.error('getAllTags:', error); return [] }
  return data as Tag[]
}

export async function getProjects(): Promise<Project[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    if (!isMissingProjectSchema(error)) console.error('getProjects:', error)
    return []
  }
  return data as Project[]
}

export async function getOrCreateProject(name: string): Promise<Project> {
  const supabase = createClient()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('请输入项目名称')

  const { data: existing } = await supabase
    .from('projects')
    .select('*')
    .ilike('name', trimmed)
    .maybeSingle()

  if (existing) return existing as Project

  const baseSlug = slugifyProjectName(trimmed)
  const { data, error } = await supabase
    .from('projects')
    .insert({ name: trimmed, slug: baseSlug })
    .select()
    .single()

  if (!error) return data as Project

  const { data: fallback, error: fallbackError } = await supabase
    .from('projects')
    .insert({ name: trimmed, slug: `${baseSlug}-${Date.now()}` })
    .select()
    .single()

  if (fallbackError) throw fallbackError
  return fallback as Project
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const supabase = createClient()

  for (const candidate of getProjectLookupCandidates(slug)) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('slug', candidate)
      .maybeSingle()

    if (error) {
      if (!isMissingProjectSchema(error)) console.error('getProjectBySlug:', error)
      return null
    }
    if (data) return data as Project
  }

  for (const candidate of getProjectLookupCandidates(slug)) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('name', candidate)
      .maybeSingle()

    if (error) {
      if (!isMissingProjectSchema(error)) console.error('getProjectByName:', error)
      return null
    }
    if (data) return data as Project
  }

  return null
}

async function getMaterialIdsForTagFilter(options?: {
  dimension?: string
  tagSlug?: string
}) {
  if (!options?.dimension && !options?.tagSlug) return null

  const supabase = createClient()
  let tagsQuery = supabase.from('tags').select('id')

  if (options.tagSlug) {
    tagsQuery = tagsQuery.eq('slug', options.tagSlug)
  } else if (options.dimension) {
    tagsQuery = tagsQuery.eq('dimension', options.dimension)
  }

  const { data: tags, error: tagsError } = await tagsQuery
  if (tagsError) { console.error('getMaterialIdsForTagFilter tags:', tagsError); return [] }

  const tagIds = (tags || []).map(tag => tag.id)
  if (tagIds.length === 0) return []

  const { data: joins, error: joinError } = await supabase
    .from('material_tags')
    .select('material_id')
    .in('tag_id', tagIds)

  if (joinError) { console.error('getMaterialIdsForTagFilter joins:', joinError); return [] }

  return Array.from(new Set((joins || []).map(row => row.material_id).filter(Boolean)))
}

export async function getMaterials(options?: {
  dimension?: string
  tagSlug?: string
  search?: string
  featuredOnly?: boolean
  limit?: number
  offset?: number
  projectId?: string
  projectIds?: string[]
}): Promise<MaterialWithTags[]> {
  const supabase = createClient()
  const materialIds = await getMaterialIdsForTagFilter(options)
  if (materialIds && materialIds.length === 0) return []

  let query = supabase
    .from('materials')
    .select(`
      *,
      project:projects(*),
      tags:material_tags(
        tag:tags(*)
      )
    `)
    .order('created_at', { ascending: false })

  if (options?.featuredOnly) {
    query = query.eq('is_featured', true)
  }

  if (options?.limit) {
    const from = options.offset || 0
    query = query.range(from, from + options.limit - 1)
  }

  if (options?.projectId) {
    query = query.eq('project_id', options.projectId)
  }

  if (options?.projectIds?.length) {
    query = query.in('project_id', options.projectIds)
  }

  if (materialIds) {
    query = query.in('id', materialIds)
  }

  if (options?.search) {
    query = query.textSearch('search_vector', options.search, { type: 'plain' })
  }

  let { data, error } = await query

  if (error) {
    if (!isMissingProjectSchema(error)) {
      console.warn('getMaterials with project relation failed, falling back:', error)
    }
    let fallback = supabase
      .from('materials')
      .select(`
        *,
        tags:material_tags(
          tag:tags(*)
        )
      `)
      .order('created_at', { ascending: false })

    if (options?.featuredOnly) fallback = fallback.eq('is_featured', true)
    if (options?.limit) {
      const from = options.offset || 0
      fallback = fallback.range(from, from + options.limit - 1)
    }
    if (options?.projectId) fallback = fallback.eq('project_id', options.projectId)
    if (options?.projectIds?.length) fallback = fallback.in('project_id', options.projectIds)
    if (materialIds) fallback = fallback.in('id', materialIds)
    if (options?.search) fallback = fallback.textSearch('search_vector', options.search, { type: 'plain' })

    const fallbackResult = await fallback
    data = fallbackResult.data as MaterialProjectRow[] | null
    error = fallbackResult.error
  }

  if (error) { console.error('getMaterials:', error); return [] }

  const materials = flattenMaterialRows(data as MaterialProjectRow[] | null)

  return materials
}

export async function getMaterialsPage(options?: {
  dimension?: string
  tagSlug?: string
  search?: string
  featuredOnly?: boolean
  limit?: number
  offset?: number
  projectId?: string
  projectIds?: string[]
}): Promise<MaterialPageResult> {
  const supabase = createClient()
  const limit = options?.limit || 60
  const offset = options?.offset || 0
  const materialIds = await getMaterialIdsForTagFilter(options)
  if (materialIds && materialIds.length === 0) {
    return { materials: [], total: 0, hasMore: false }
  }

  let query = supabase
    .from('materials')
    .select(`
      *,
      project:projects(*),
      tags:material_tags(
        tag:tags(*)
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (options?.featuredOnly) query = query.eq('is_featured', true)
  if (options?.projectId) query = query.eq('project_id', options.projectId)
  if (options?.projectIds?.length) query = query.in('project_id', options.projectIds)
  if (materialIds) query = query.in('id', materialIds)
  if (options?.search) query = query.textSearch('search_vector', options.search, { type: 'plain' })

  let { data, error, count } = await query

  if (error) {
    if (!isMissingProjectSchema(error)) {
      console.warn('getMaterialsPage with project relation failed, falling back:', error)
    }
    let fallback = supabase
      .from('materials')
      .select(`
        *,
        tags:material_tags(
          tag:tags(*)
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (options?.featuredOnly) fallback = fallback.eq('is_featured', true)
    if (options?.projectId) fallback = fallback.eq('project_id', options.projectId)
    if (options?.projectIds?.length) fallback = fallback.in('project_id', options.projectIds)
    if (materialIds) fallback = fallback.in('id', materialIds)
    if (options?.search) fallback = fallback.textSearch('search_vector', options.search, { type: 'plain' })

    const fallbackResult = await fallback
    data = fallbackResult.data as MaterialProjectRow[] | null
    error = fallbackResult.error
    count = fallbackResult.count
  }

  if (error) {
    console.error('getMaterialsPage:', error)
    return { materials: [], total: 0, hasMore: false }
  }

  const materials = flattenMaterialRows(data as MaterialProjectRow[] | null)
  const total = count ?? null
  return {
    materials,
    total,
    hasMore: total === null ? materials.length === limit : offset + materials.length < total,
  }
}

export async function getMaterialById(id: string): Promise<MaterialWithTags | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('materials')
    .select(`
      *,
      project:projects(*),
      tags:material_tags(
        tag:tags(*)
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (!isMissingProjectSchema(error)) {
      console.warn('getMaterialById with project relation failed, falling back:', error)
    }
    const fallback = await supabase
      .from('materials')
      .select(`
        *,
        tags:material_tags(
          tag:tags(*)
        )
      `)
      .eq('id', id)
      .single()

    if (fallback.error) { console.error('getMaterialById:', fallback.error); return null }
    return flattenMaterialRows([fallback.data as MaterialProjectRow])[0]
  }

  return flattenMaterialRows([data as MaterialProjectRow])[0]
}

export async function findMaterialByHash(hash: string): Promise<boolean> {
  const supabase = createClient()
  // Check by hash column (works for materials uploaded after hash feature)
  const { data: byHash } = await supabase
    .from('materials')
    .select('id')
    .eq('image_hash', hash)
    .maybeSingle()
  if (byHash) return true
  // Check by URL containing hash as filename (works after key-as-hash upload strategy)
  const { data: byUrl } = await supabase
    .from('materials')
    .select('id')
    .like('image_url', `%/${hash}.%`)
    .maybeSingle()
  if (byUrl) return true
  return false
}

export async function createMaterial(material: {
  title: string
  description?: string
  image_url: string
  source_url?: string
  source_platform?: string
  author?: string
  image_hash?: string
  project_id?: string
  is_featured?: boolean
  tagIds?: string[]
}) {
  const supabase = createClient()

  const { tagIds, ...rest } = material

  const { data, error } = await supabase
    .from('materials')
    .insert(rest)
    .select()
    .single()

  if (error) throw error

  if (tagIds && tagIds.length > 0) {
    const { error: tagError } = await supabase
      .from('material_tags')
      .insert(tagIds.map(tagId => ({ material_id: data.id, tag_id: tagId })))

    if (tagError) throw tagError
  }

  return data
}

export async function updateMaterial(id: string, updates: {
  title?: string
  description?: string
  source_url?: string
  source_platform?: string
  author?: string
  project_id?: string | null
}) {
  const supabase = createClient()
  const { error } = await supabase.from('materials').update(updates).eq('id', id)
  if (error) throw error
}

export async function updateMaterialTags(materialId: string, tagIds: string[]) {
  const supabase = createClient()
  // Delete existing tags
  const { error: delError } = await supabase
    .from('material_tags')
    .delete()
    .eq('material_id', materialId)
  if (delError) throw delError
  // Insert new tags
  if (tagIds.length > 0) {
    const { error: insError } = await supabase
      .from('material_tags')
      .insert(tagIds.map(tagId => ({ material_id: materialId, tag_id: tagId })))
    if (insError) throw insError
  }
}

export async function deleteMaterial(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('materials').delete().eq('id', id)
  if (error) throw error
}

export async function toggleFeatured(id: string, value: boolean) {
  const supabase = createClient()
  const { error } = await supabase.from('materials').update({ is_featured: value }).eq('id', id)
  if (error) throw error
}

export async function uploadImage(file: File, hash?: string): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  // Use hash as filename for deduplication (same file → same URL)
  const key = hash ? `${hash}.${ext}` : `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabase.storage
    .from('materials')
    .upload(key, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(error.message)

  const { data: { publicUrl } } = supabase.storage
    .from('materials')
    .getPublicUrl(data.path)

  return publicUrl
}

export async function createTag(tag: { name: string; slug: string; dimension: string; color?: string }) {
  const supabase = createClient()
  const { data, error } = await supabase.from('tags').insert(tag).select().single()
  if (error) throw error
  return data
}

export async function getOrCreateTag(name: string, dimension: TagDimension = 'element'): Promise<Tag> {
  const supabase = createClient()
  const trimmed = name.trim()

  // Try to find existing tag by name (case-insensitive)
  const { data: existing } = await supabase
    .from('tags')
    .select('*')
    .ilike('name', trimmed)
    .maybeSingle()

  if (existing) return existing as Tag

  // Create new tag
  const slug = `${trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '')}-${Date.now()}`
  const { data, error } = await supabase
    .from('tags')
    .insert({ name: trimmed, slug, dimension })
    .select()
    .single()

  if (error) throw error
  return data as Tag
}

export async function deleteTag(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw error
}
