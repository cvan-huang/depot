-- Seed tags
insert into tags (name, slug, dimension, color) values
  -- Scene
  ('品牌', 'brand', 'scene', '#FF2442'),
  ('运营', 'operation', 'scene', '#FF6B6B'),
  ('包装', 'packaging', 'scene', '#FF8E53'),
  ('多媒体', 'multimedia', 'scene', '#C44EFF'),
  ('衍生品', 'merchandise', 'scene', '#FF4EA0'),
  -- Style
  ('极简高级', 'minimal', 'style', '#1A1A1A'),
  ('拼贴', 'collage', 'style', '#FF9F43'),
  ('插画', 'illustration', 'style', '#48DBFB'),
  ('3D', '3d', 'style', '#0ABDE3'),
  ('复古', 'retro', 'style', '#F9CA24'),
  ('怪诞超现实', 'surreal', 'style', '#6C5CE7'),
  ('时髦', 'chic', 'style', '#FD79A8'),
  ('年轻前卫', 'avant-garde', 'style', '#00B894'),
  -- Element
  ('排版字体', 'typography', 'element', '#636E72'),
  ('色彩搭配', 'color', 'element', '#FDCB6E'),
  ('插画', 'illustration-el', 'element', '#74B9FF'),
  ('摄影', 'photography', 'element', '#55EFC4'),
  ('拼贴', 'collage-el', 'element', '#A29BFE'),
  ('3D', '3d-el', 'element', '#81ECEC')
on conflict (slug) do nothing;

-- Seed materials (using Unsplash images with XHS-aesthetic keywords)
insert into materials (title, description, image_url, source_url, source_platform, is_featured) values
  ('极简品牌视觉', '干净的白色背景配合精准的排版，高级感扑面而来', 'https://images.unsplash.com/photo-1634733988138-bf2c3a2a13fa?w=800&q=80', 'https://unsplash.com', 'Unsplash', true),
  ('国潮包装设计', '东方美学与现代设计语言的融合，呈现独特的中式高端感', 'https://images.unsplash.com/photo-1586880244406-556ebe35f282?w=800&q=80', 'https://unsplash.com', 'Unsplash', true),
  ('3D产品展示', '立体感十足的产品渲染，视觉冲击力强', 'https://images.unsplash.com/photo-1633354931133-27b1a9b3f5b3?w=600&q=80', 'https://unsplash.com', 'Unsplash', true),
  ('插画风运营海报', '手绘插画结合活泼色块，年轻有活力', 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=600&q=80', 'https://unsplash.com', 'Unsplash', false),
  ('复古拼贴风格', '撕纸感与胶片质感叠加，充满年代记忆', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80', 'https://unsplash.com', 'Unsplash', true),
  ('时髦摄影风格', '高对比度摄影配色，时尚大片质感', 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&q=80', 'https://unsplash.com', 'Unsplash', false),
  ('年轻前卫视觉', '打破常规的构图与色彩搭配，先锋艺术感', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', 'https://unsplash.com', 'Unsplash', true),
  ('衍生品设计展示', '品牌衍生品的高质感陈列拍摄风格', 'https://images.unsplash.com/photo-1547949003-9792a18a2601?w=600&q=80', 'https://unsplash.com', 'Unsplash', false),
  ('怪诞超现实合成', '天马行空的视觉创意，超现实主义的视觉表达', 'https://images.unsplash.com/photo-1604871000636-074fa5117945?w=800&q=80', 'https://unsplash.com', 'Unsplash', true),
  ('极简字体排版', '字体即设计，用排版讲故事', 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&q=80', 'https://unsplash.com', 'Unsplash', false),
  ('色彩搭配参考', '和谐又大胆的色彩系统，奠定品牌调性', 'https://images.unsplash.com/photo-1579547621113-e4bb2a19bdd6?w=800&q=80', 'https://unsplash.com', 'Unsplash', false),
  ('多媒体动态视觉', '适合短视频的视觉语言与动态感', 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&q=80', 'https://unsplash.com', 'Unsplash', true),
  ('品牌全套VI', '系统化的品牌视觉识别体系', 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80', 'https://unsplash.com', 'Unsplash', false),
  ('食品包装设计', '清新自然的食品类包装设计参考', 'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&q=80', 'https://unsplash.com', 'Unsplash', false),
  ('3D字体设计', '立体字在海报中的应用参考', 'https://images.unsplash.com/photo-1636955816868-fcb881e57954?w=800&q=80', 'https://unsplash.com', 'Unsplash', true),
  ('复古海报风格', '70-80年代复古印刷风格的现代演绎', 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600&q=80', 'https://unsplash.com', 'Unsplash', false),
  ('插画品牌形象', '可爱插画风格的品牌视觉呈现', 'https://images.unsplash.com/photo-1618004652321-13a63e576b80?w=800&q=80', 'https://unsplash.com', 'Unsplash', false),
  ('运营活动页面', '促销活动的视觉层次与信息架构', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80', 'https://unsplash.com', 'Unsplash', true)
on conflict do nothing;
