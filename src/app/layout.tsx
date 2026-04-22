import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'DEPOT · 设计素材库',
  description: '专为设计师精选的参考素材，按场景、风格、元素三维度探索 XHS 设计审美',
  keywords: '设计参考, 小红书设计, 素材库, 设计灵感, moodboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Navbar />
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
