import { createClient } from './server'
import { MaterialWithTags, Project, Tag } from '@/types'

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
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('dimension')
    .order('name')
  if (error) { console.error('getAllTags:', error); return [] }
  return data as Tag[]
}

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient()
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

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const supabase = await createClient()

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

export async function getMaterials(options?: { projectId?: string }): Promise<MaterialWithTags[]> {
  const supabase = await createClient()
  let query = supabase
    .from('materials')
    .select(`*, project:projects(*), tags:material_tags(tag:tags(*))`)
    .order('created_at', { ascending: false })

  if (options?.projectId) query = query.eq('project_id', options.projectId)

  let { data, error } = await query

  if (error) {
    if (!isMissingProjectSchema(error)) {
      console.warn('getMaterials with project relation failed, falling back:', error)
    }
    let fallback = supabase
      .from('materials')
      .select(`*, tags:material_tags(tag:tags(*))`)
      .order('created_at', { ascending: false })

    if (options?.projectId) fallback = fallback.eq('project_id', options.projectId)

    const fallbackResult = await fallback
    data = fallbackResult.data as MaterialProjectRow[] | null
    error = fallbackResult.error
  }

  if (error) { console.error('getMaterials:', error); return [] }
  return flattenMaterialRows(data as MaterialProjectRow[] | null)
}

export async function getMaterialById(id: string): Promise<MaterialWithTags | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('materials')
    .select(`*, project:projects(*), tags:material_tags(tag:tags(*))`)
    .eq('id', id)
    .single()
  if (error) {
    if (!isMissingProjectSchema(error)) {
      console.warn('getMaterialById with project relation failed, falling back:', error)
    }
    const fallback = await supabase
      .from('materials')
      .select(`*, tags:material_tags(tag:tags(*))`)
      .eq('id', id)
      .single()
    if (fallback.error) { console.error('getMaterialById:', fallback.error); return null }
    return flattenMaterialRows([fallback.data as MaterialProjectRow])[0]
  }
  return flattenMaterialRows([data as MaterialProjectRow])[0]
}
