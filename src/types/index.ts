export type TagDimension = 'scene' | 'style' | 'element'

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
  is_featured: boolean
  created_at: string
}

export interface MaterialWithTags extends Material {
  tags: Tag[]
}
