import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

const SCENE_TAGS = ['品牌', '运营', '包装', '多媒体', '衍生品']
const STYLE_TAGS = ['极简高级', '拼贴', '插画', '3D', '复古', '怪诞超现实', '时髦', '年轻前卫']
const ELEMENT_TAGS = ['排版字体', '色彩搭配', '插画', '摄影', '拼贴', '3D']

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

async function toCompressedBase64(imageUrl: string): Promise<string> {
  // Fetch image from Supabase (our server can reach it)
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`图片获取失败: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())

  // Resize to max 512px and compress to JPEG < 300KB
  const compressed = await sharp(buffer)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer()

  return `data:image/jpeg;base64,${compressed.toString('base64')}`
}

const prompt = `你是一个专业的设计审美分析师，专注于小红书平台的设计风格。

请分析这张设计参考图，从以下三个维度的标签中选择最合适的标签（可多选）：

场景标签（选 1-2 个）：${SCENE_TAGS.join('、')}
风格标签（选 1-3 个）：${STYLE_TAGS.join('、')}
元素标签（选 1-3 个）：${ELEMENT_TAGS.join('、')}

同时生成一个简洁的中文标题（10字以内）和一句描述（30字以内），描述这张图的设计亮点。

严格按以下 JSON 格式返回，不要有其他文字：
{"title":"标题","description":"描述","scene":["标签"],"style":["标签1","标签2"],"element":["标签1"]}`

export async function POST(req: NextRequest) {
  const provider = getProviderConfig()
  if (!provider) {
    return NextResponse.json({ error: '未配置 AI API Key' }, { status: 500 })
  }

  const { imageUrl, imageBase64 } = await req.json()
  if (!imageUrl && !imageBase64) {
    return NextResponse.json({ error: '请提供图片' }, { status: 400 })
  }

  // Always convert to small compressed base64 on our server
  let imageDataUrl = ''
  try {
    if (imageUrl) {
      imageDataUrl = await toCompressedBase64(imageUrl)
    } else if (imageBase64) {
      // Strip data URL prefix and decompress through sharp
      const b64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      const buf = Buffer.from(b64, 'base64')
      const compressed = await sharp(buf)
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

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '分析失败' }, { status: 500 })
  }
}
