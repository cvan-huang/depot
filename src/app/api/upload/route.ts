import { NextRequest, NextResponse } from 'next/server'
import * as qiniu from 'qiniu'

export async function POST(req: NextRequest) {
  const accessKey = process.env.QINIU_ACCESS_KEY
  const secretKey = process.env.QINIU_SECRET_KEY
  const bucket = process.env.QINIU_BUCKET
  const domain = process.env.QINIU_DOMAIN

  if (!accessKey || !secretKey || !bucket || !domain) {
    return NextResponse.json({ error: '七牛云配置缺失' }, { status: 500 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: '未收到文件' }, { status: 400 })

    // Generate upload token
    const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)
    const putPolicy = new qiniu.rs.PutPolicy({ scope: bucket })
    const token = putPolicy.uploadToken(mac)

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'jpg'
    // Use hash as key so identical images always map to the same URL
    const hashParam = formData.get('hash') as string | null
    const key = hashParam ? `${hashParam}.${ext}` : `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Upload to Qiniu
    const config = new qiniu.conf.Config()
    // 华东区域
    ;(config as any).zone = qiniu.zone.Zone_z0

    const formUploader = new qiniu.form_up.FormUploader(config)
    const putExtra = new qiniu.form_up.PutExtra()

    const result = await new Promise<{ key: string }>((resolve, reject) => {
      formUploader.put(token, key, buffer, putExtra, (err: any, body: any, info: any) => {
        if (err) return reject(err)
        if (info.statusCode !== 200) return reject(new Error(body.error || '上传失败'))
        resolve(body)
      })
    })

    const publicUrl = `http://${domain}/${result.key}`
    return NextResponse.json({ url: publicUrl })
  } catch (err: any) {
    console.error('Qiniu upload error:', err)
    return NextResponse.json({ error: err.message || '上传失败' }, { status: 500 })
  }
}
