import { createClient } from './client'
import { MaterialWithTags, Tag } from '@/types'

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

export async function getMaterials(options?: {
  dimension?: string
  tagSlug?: string
  search?: string
  featuredOnly?: boolean
  limit?: number
}): Promise<MaterialWithTags[]> {
  const supabase = createClient()

  let query = supabase
    .from('materials')
    .select(`
      *,
      tags:material_tags(
        tag:tags(*)
      )
    `)
    .order('created_at', { ascending: false })

  if (options?.featuredOnly) {
    query = query.eq('is_featured', true)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.search) {
    query = query.textSearch('search_vector', options.search, { type: 'plain' })
  }

  const { data, error } = await query

  if (error) { console.error('getMaterials:', error); return [] }

  // Flatten the nested join structure
  let materials = (data || []).map((m: any) => ({
    ...m,
    tags: (m.tags || []).map((t: any) => t.tag).filter(Boolean),
  })) as MaterialWithTags[]

  // Filter by specific tag first
  if (options?.tagSlug) {
    materials = materials.filter(m => m.tags.some((t: Tag) => t.slug === options.tagSlug))
  } else if (options?.dimension) {
    // Filter by dimension: show materials that have at least one tag in this dimension
    materials = materials.filter(m => m.tags.some((t: Tag) => t.dimension === options.dimension))
  }

  return materials
}

export async function getMaterialById(id: string): Promise<MaterialWithTags | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('materials')
    .select(`
      *,
      tags:material_tags(
        tag:tags(*)
      )
    `)
    .eq('id', id)
    .single()

  if (error) { console.error('getMaterialById:', error); return null }

  return {
    ...data,
    tags: (data.tags || []).map((t: any) => t.tag).filter(Boolean),
  } as MaterialWithTags
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
  const formData = new FormData()
  formData.append('file', file)
  if (hash) formData.append('hash', hash)

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '上传失败')
  return data.url
}

export async function createTag(tag: { name: string; slug: string; dimension: string; color?: string }) {
  const supabase = createClient()
  const { data, error } = await supabase.from('tags').insert(tag).select().single()
  if (error) throw error
  return data
}

export async function getOrCreateTag(name: string): Promise<Tag> {
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
    .insert({ name: trimmed, slug, dimension: 'element' })
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
