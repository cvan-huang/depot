import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { AnalyzeImageResult, Tag, TagDimension, TagSuggestion } from '@/types'

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

function isGifUrl(url: string) {
  return /\.gif(\?|$)/i.test(url)
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getExistingTags(): Promise<Tag[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('dimension')
    .order('name')

  if (error) {
    console.error('analyze-image getExistingTags:', error)
    return []
  }

  return (data || []) as Tag[]
}

function formatTagsForPrompt(tags: Tag[]) {
  const grouped = tags.reduce<Record<TagDimension, string[]>>((acc, tag) => {
    acc[tag.dimension].push(tag.name)
    return acc
  }, { scene: [], style: [], element: [] })

  return [
    `场景标签：${grouped.scene.join('、') || '无'}`,
    `风格标签：${grouped.style.join('、') || '无'}`,
    `元素标签：${grouped.element.join('、') || '无'}`,
  ].join('\n')
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

function toTagSuggestions(value: unknown): TagSuggestion[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item): TagSuggestion | null => {
      if (typeof item === 'string') {
        const name = item.trim()
        return name ? { name } : null
      }

      if (item && typeof item === 'object' && 'name' in item) {
        const raw = item as { name?: unknown; dimension?: unknown }
        const name = typeof raw.name === 'string' ? raw.name.trim() : ''
        const dimension = raw.dimension
        if (!name) return null
        if (dimension === 'scene' || dimension === 'style' || dimension === 'element') {
          return { name, dimension }
        }
        return { name }
      }

      return null
    })
    .filter((item): item is TagSuggestion => Boolean(item))
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

function buildPrompt(existingTags: Tag[]) {
  return `你是一个专业的设计审美分析师。

请分析这张设计参考图，生成简洁中文标题、描述，并推荐标签。

现有标签库如下，请优先从中选择最匹配的 5-10 个标签，matchedTags 必须严格使用现有标签名称，不要改写：
${formatTagsForPrompt(existingTags)}

如果现有标签确实覆盖不了图片特征，最多推荐 3 个新标签候选，放入 newTagCandidates。新标签要求简洁（2-6个字）、专业且具体，并尽量标注 dimension：scene、style 或 element。

标题要求 10 字以内。描述要求 30 字以内，描述设计亮点。

严格按以下 JSON 格式返回，不要有其他文字：
{"title":"标题","description":"描述","matchedTags":["已有标签1","已有标签2"],"newTagCandidates":[{"name":"新标签","dimension":"style"}]}`
}

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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '未知错误'
    return NextResponse.json({ error: `图片处理失败: ${message}` }, { status: 500 })
  }

  try {
    const existingTags = await getExistingTags()
    const existingTagNames = new Set(existingTags.map(tag => tag.name.toLowerCase()))

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
            { type: 'text', text: buildPrompt(existingTags) },
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

    const rawResult = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const matchedTags = toStringArray(rawResult.matchedTags ?? rawResult.tags)
      .filter(name => existingTagNames.has(name.toLowerCase()))
    const seenMatched = new Set(matchedTags.map(name => name.toLowerCase()))
    const newTagCandidates = toTagSuggestions(rawResult.newTagCandidates)
      .filter(tag => !existingTagNames.has(tag.name.toLowerCase()))
      .filter(tag => !seenMatched.has(tag.name.toLowerCase()))
      .slice(0, 3)

    const result: AnalyzeImageResult = {
      title: typeof rawResult.title === 'string' ? rawResult.title : '',
      description: typeof rawResult.description === 'string' ? rawResult.description : '',
      matchedTags,
      newTagCandidates,
    }

    // Tell client to auto-add "动态" tag for animated formats
    if (animated) result._animated = true
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '分析失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
