import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

function getProviderConfig() {
  if (process.env.DOUBAO_API_KEY) {
    return {
      apiKey: process.env.DOUBAO_API_KEY,
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      model: 'ep-20260421190240-s4nnf',
      name: '豆包',
    }
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      name: 'OpenAI',
    }
  }
  return null
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url)
}

function isGifUrl(url: string) {
  return /\.gif(\?|$)/i.test(url)
}

async function toCompressedBase64(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`图片获取失败: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())

  // animated: false → only process first frame (needed for GIF)
  const compressed = await sharp(buffer, { animated: false })
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer()

  return `data:image/jpeg;base64,${compressed.toString('base64')}`
}

const prompt = `你是一个专业的设计审美分析师。

请分析这张设计参考图，自由生成 8-12 个中文标签，描述其设计风格、视觉元素、使用场景和设计手法。
要求：标签简洁（2-6个字），专业且具体，避免泛泛而谈。
示例风格：极简排版、撞色配色、手绘插画、品牌视觉、3D立体感、日系清新、文字海报、几何构成……

同时生成一个简洁的中文标题（10字以内）和一句描述（30字以内），描述这张图的设计亮点。

严格按以下 JSON 格式返回，不要有其他文字：
{"title":"标题","description":"描述","tags":["标签1","标签2","标签3"]}`

export async function POST(req: NextRequest) {
  const provider = getProviderConfig()
  if (!provider) {
    return NextResponse.json({ error: '未配置 AI API Key' }, { status: 500 })
  }

  const { imageUrl, imageBase64 } = await req.json()
  if (!imageUrl && !imageBase64) {
    return NextResponse.json({ error: '请提供图片' }, { status: 400 })
  }

  const animated = imageUrl ? isGifUrl(imageUrl) : false

  // Always convert to small compressed base64 on our server
  let imageDataUrl = ''
  try {
    if (imageUrl) {
      imageDataUrl = await toCompressedBase64(imageUrl)
    } else if (imageBase64) {
      const b64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      const buf = Buffer.from(b64, 'base64')
      const compressed = await sharp(buf, { animated: false })
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer()
      imageDataUrl = `data:image/jpeg;base64,${compressed.toString('base64')}`
    }
  } catch (e: any) {
    return NextResponse.json({ error: `图片处理失败: ${e.message}` }, { status: 500 })
  }

  try {
    const response = await fetch(provider.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageDataUrl } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

    const respText = await response.text()
    if (!response.ok) {
      let msg = respText
      try { msg = JSON.parse(respText)?.error?.message || respText } catch {}
      console.error('AI error:', response.status, msg)
      return NextResponse.json({ error: `${provider.name} ${response.status}: ${msg.slice(0, 300)}` }, { status: 500 })
    }

    const data = JSON.parse(respText)
    const content = data.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: `AI 返回格式异常: ${content.slice(0, 100)}` }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])
    // Tell client to auto-add "动态" tag for animated formats
    if (animated) result._animated = true
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '分析失败' }, { status: 500 })
  }
}
