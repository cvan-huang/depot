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

  // Client-side filter: only filter when a specific tag is selected
  // When just browsing a dimension, show all materials (including untagged)
  if (options?.tagSlug) {
    materials = materials.filter(m => m.tags.some((t: Tag) => t.slug === options.tagSlug))
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

export async function createMaterial(material: {
  title: string
  description?: string
  image_url: string
  source_url?: string
  source_platform?: string
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

export async function uploadImage(file: File): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from('images')
    .upload(filename, file, { cacheControl: '3600', upsert: false })

  if (error) throw error

  const { data } = supabase.storage.from('images').getPublicUrl(filename)
  return data.publicUrl
}

export async function createTag(tag: { name: string; slug: string; dimension: string; color?: string }) {
  const supabase = createClient()
  const { data, error } = await supabase.from('tags').insert(tag).select().single()
  if (error) throw error
  return data
}

export async function deleteTag(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw error
}
