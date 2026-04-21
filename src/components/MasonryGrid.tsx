'use client'

import Masonry from 'react-masonry-css'
import { MaterialWithTags } from '@/types'
import MaterialCard from './MaterialCard'

const breakpointCols = {
  default: 4,
  1280: 4,
  1024: 3,
  768: 2,
  640: 2,
  480: 2,
}

interface MasonryGridProps {
  materials: MaterialWithTags[]
}

export default function MasonryGrid({ materials }: MasonryGridProps) {
  if (materials.length === 0) {
    return (
      <div className="border-heavy flex flex-col items-center justify-center py-24 text-center">
        <p className="heading-display text-4xl mb-3">NO RESULTS</p>
        <p className="nav-label text-[#808080]">换个关键词或标签试试</p>
      </div>
    )
  }

  return (
    <Masonry
      breakpointCols={breakpointCols}
      className="masonry-grid"
      columnClassName="masonry-grid-column"
    >
      {materials.map((material) => (
        <div key={material.id} className="mb-[1.5px]">
          <MaterialCard material={material} />
        </div>
      ))}
    </Masonry>
  )
}
