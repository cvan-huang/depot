import { Suspense } from 'react'
import GalleryView from '@/components/GalleryView'

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>}>
      <GalleryView />
    </Suspense>
  )
}
