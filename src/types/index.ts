export type TagDimension = 'scene' | 'style' | 'element'

export interface Project {
  id: string
  name: string
  slug: string
  description?: string
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  slug: string
  dimension: TagDimension
  color?: string
}

export interface Material {
  id: string
  title: string
  description?: string
  image_url: string
  source_url?: string
  source_platform?: string
  author?: string
  image_hash?: string
  project_id?: string
  is_featured: boolean
  created_at: string
}

export interface MaterialWithTags extends Material {
  tags: Tag[]
  project?: Project | null
}

export interface MaterialPageResult {
  materials: MaterialWithTags[]
  total: number | null
  hasMore: boolean
}

export interface TagSuggestion {
  name: string
  dimension?: TagDimension
}

export interface AnalyzeImageResult {
  title: string
  description: string
  matchedTags: string[]
  newTagCandidates: TagSuggestion[]
  _animated?: boolean
}
