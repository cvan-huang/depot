'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useMemo, useState, useCallback } from 'react'
import { MOCK_TAGS, MOCK_MATERIALS } from '@/lib/mock-data'
import { TagDimension } from '@/types'
import MasonryGrid from '@/components/MasonryGrid'
import { cn } from '@/lib/utils'

const DIMENSION_LABELS: Record<TagDimension, string> = {
  scene: 'SCENE',
  style: 'STYLE',
  element: 'ELEMENT',
}

const SORT_OPTIONS = [
  { value: 'latest', label: 'LATEST' },
  { value: 'featured', label: 'PICKS FIRST' },
]

export default function GalleryClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const q = searchParams.get('q') || ''
  const dim = searchParams.get('dim') as TagDimension | null
  const tag = searchParams.get('tag') || ''
  const sort = searchParams.get('sort') || 'latest'

  const [searchInput, setSearchInput] = useState(q)
  const [activeDim, setActiveDim] = useState<TagDimension | null>(dim)
  const [activeTag, setActiveTag] = useState(tag)

  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, val]) => {
      if (val) params.set(key, val)
      else params.delete(key)
    })
    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  const filteredMaterials = useMemo(() => {
    let results = [...MOCK_MATERIALS]

    if (q) {
      const lower = q.toLowerCase()
      results = results.filter(m =>
        m.title.toLowerCase().includes(lower) ||
        (m.description?.toLowerCase().includes(lower))
      )
    }

    if (tag) {
      results = results.filter(m => m.tags.some(t => t.slug === tag))
    } else if (dim) {
      results = results.filter(m => m.tags.some(t => t.dimension === dim))
    }

    if (sort === 'featured') {
      results = [...results.filter(m => m.is_featured), ...results.filter(m => !m.is_featured)]
    } else {
      results = results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return results
  }, [q, dim, tag, sort])

  const visibleTags = useMemo(() => {
    if (!activeDim) return MOCK_TAGS
    return MOCK_TAGS.filter(t => t.dimension === activeDim)
  }, [activeDim])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams({ q: searchInput, tag: '', dim: '' })
    setActiveTag('')
    setActiveDim(null)
  }

  const handleDimClick = (d: TagDimension) => {
    const next = activeDim === d ? null : d
    setActiveDim(next)
    setActiveTag('')
    updateParams({ dim: next || '', tag: '' })
  }

  const handleTagClick = (slug: string, dimension: TagDimension) => {
    const next = activeTag === slug ? '' : slug
    setActiveTag(next)
    if (next) {
      setActiveDim(dimension)
      updateParams({ tag: next, dim: dimension })
    } else {
      updateParams({ tag: '', dim: activeDim || '' })
    }
  }

  const handleReset = () => {
    setSearchInput('')
    setActiveDim(null)
    setActiveTag('')
    router.push(pathname)
  }

  const hasFilter = q || dim || tag

  return (
    <div className="bg-white">
      {/* Page header */}
      <div className="border-bottom-heavy">
        <div className="flex items-stretch">
          <div className="border-right-heavy px-6 py-4 flex-1">
            <h1 className="heading-display text-3xl">REFERENCE LIBRARY</h1>
          </div>
          <div className="px-6 py-4 flex items-center">
            <span className="nav-label text-[#808080]">{filteredMaterials.length} ITEMS</span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-bottom-heavy">
        {/* Search + sort row */}
        <div className="border-bottom-heavy flex items-stretch">
          <form onSubmit={handleSearch} className="flex flex-1 border-right-heavy">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="SEARCH..."
              className="search-input flex-1 h-10 px-4 text-xs font-bold uppercase tracking-widest placeholder:text-[#808080] bg-white focus:bg-[#F0F0F0] transition-colors"
            />
            <button
              type="submit"
              className="h-10 px-4 bg-black text-white nav-label hover:bg-[#FF2442] transition-colors border-left-heavy shrink-0"
            >
              GO
            </button>
          </form>

          {/* Sort */}
          <div className="flex items-stretch border-right-heavy">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => updateParams({ sort: opt.value })}
                className={cn(
                  'px-4 nav-label text-[10px] border-right-heavy last:border-0 transition-colors',
                  sort === opt.value ? 'bg-black text-white' : 'hover:bg-[#F0F0F0]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {hasFilter && (
            <button
              onClick={handleReset}
              className="px-4 nav-label text-[10px] text-[#FF2442] hover:bg-[#FF2442] hover:text-white transition-colors"
            >
              CLEAR ×
            </button>
          )}
        </div>

        {/* Dimension + tag row */}
        <div className="flex items-stretch flex-wrap">
          {/* Dimension pills */}
          <div className="flex items-stretch border-right-heavy">
            <span className="nav-label text-[9px] text-[#808080] px-3 flex items-center border-right-heavy bg-[#F0F0F0]">
              DIM
            </span>
            {(Object.keys(DIMENSION_LABELS) as TagDimension[]).map((d) => (
              <button
                key={d}
                onClick={() => handleDimClick(d)}
                className={cn(
                  'px-4 py-2.5 nav-label text-[10px] border-right-heavy transition-colors',
                  activeDim === d ? 'bg-black text-white' : 'hover:bg-[#F0F0F0]'
                )}
              >
                {DIMENSION_LABELS[d]}
              </button>
            ))}
          </div>

          {/* Tags scrollable */}
          <div className="flex items-stretch overflow-x-auto flex-1">
            {visibleTags.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTagClick(t.slug, t.dimension)}
                className={cn(
                  'px-3 py-2.5 nav-label text-[10px] border-right-heavy shrink-0 transition-colors',
                  activeTag === t.slug ? 'bg-black text-white' : 'hover:bg-[#F0F0F0]'
                )}
                style={activeTag === t.slug ? {} : { color: t.color || '#000' }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="p-[0.75px]">
        <MasonryGrid materials={filteredMaterials} />
      </div>
    </div>
  )
}
