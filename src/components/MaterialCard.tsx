'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MaterialWithTags } from '@/types'
import { cn } from '@/lib/utils'

interface MaterialCardProps {
  material: MaterialWithTags
  className?: string
}

export default function MaterialCard({ material, className }: MaterialCardProps) {
  return (
    <Link href={`/material/${material.id}`}>
      <div className={cn('material-card border-heavy bg-white group', className)}>
        {/* Image */}
        <div className="relative w-full bg-[#F0F0F0] overflow-hidden border-bottom-heavy">
          <Image
            src={material.image_url}
            alt={material.title}
            width={400}
            height={300}
            className="w-full h-auto object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            unoptimized
          />
          {material.is_featured && (
            <span className="absolute top-0 left-0 bg-[#FF2442] text-white nav-label px-2 py-1">
              PICK
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5">
          <h3 className="text-xs font-bold text-black uppercase tracking-wide leading-tight line-clamp-1 mb-1.5">
            {material.title}
          </h3>
          {material.tags && material.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {material.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="nav-label text-[9px] px-1.5 py-0.5 border border-black"
                  style={{ color: tag.color || '#000' }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
