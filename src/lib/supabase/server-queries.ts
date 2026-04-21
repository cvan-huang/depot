import { createClient } from './server'
import { MaterialWithTags, Tag } from '@/types'

export async function getAllTags(): Promise<Tag[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('dimension')
    .order('name')
  if (error) { console.error('getAllTags:', error); return [] }
  return data as Tag[]
}

export async function getMaterials(): Promise<MaterialWithTags[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('materials')
    .select(`*, tags:material_tags(tag:tags(*))`)
    .order('created_at', { ascending: false })
  if (error) { console.error('getMaterials:', error); return [] }
  return (data || []).map((m: any) => ({
    ...m,
    tags: (m.tags || []).map((t: any) => t.tag).filter(Boolean),
  })) as MaterialWithTags[]
}

export async function getMaterialById(id: string): Promise<MaterialWithTags | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('materials')
    .select(`*, tags:material_tags(tag:tags(*))`)
    .eq('id', id)
    .single()
  if (error) { console.error('getMaterialById:', error); return null }
  return {
    ...data,
    tags: (data.tags || []).map((t: any) => t.tag).filter(Boolean),
  } as MaterialWithTags
}
