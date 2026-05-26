import { isAdminAuthConfigured, isUsingLocalDevPassword } from '@/lib/admin-auth'

interface Props {
  searchParams: Promise<{ next?: string; error?: string }>
}

const font = '"Helvetica Neue", "PingFang SC", Arial, sans-serif'

function getSafeNext(next?: string) {
  if (!next || !next.startsWith('/admin') || next.startsWith('/admin/login')) {
    return '/admin'
  }
  return next
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams
  const safeNext = getSafeNext(next)
  const configured = isAdminAuthConfigured()
  const usingLocalPassword = isUsingLocalDevPassword()

  return (
    <main style={{ minHeight: '100vh', background: '#fff', fontFamily: font, display: 'grid', placeItems: 'center', padding: '48px' }}>
      <form
        action="/api/admin/login"
        method="post"
        style={{ width: '100%', maxWidth: '420px', border: '1px solid #E8E8E8', padding: '32px', background: '#fff' }}
      >
        <input type="hidden" name="next" value={safeNext} />
        <p style={{ fontSize: '11px', color: '#BDBDBD', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
          ADMIN ACCESS
        </p>
        <h1 style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-0.03em', color: '#111', marginBottom: '28px' }}>
          DEPOT
        </h1>

        <label style={{ display: 'block', fontSize: '11px', color: '#808080', marginBottom: '8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          管理员口令
        </label>
        <input
          name="password"
          type="password"
          autoFocus
          disabled={!configured}
          placeholder={configured ? '输入后台口令' : '未配置 ADMIN_PASSWORD'}
          style={{
            width: '100%',
            height: '44px',
            border: '1px solid #D8D8D8',
            padding: '0 12px',
            fontSize: '14px',
            outline: 'none',
            marginBottom: '14px',
            background: configured ? '#fff' : '#F7F7F7',
          }}
        />

        {error === '1' && (
          <p style={{ fontSize: '12px', color: '#FF2442', marginBottom: '14px' }}>
            口令不正确，请重试。
          </p>
        )}
        {error === 'config' && (
          <p style={{ fontSize: '12px', color: '#FF2442', marginBottom: '14px' }}>
            生产环境还没有配置 ADMIN_PASSWORD，后台已保持锁定。
          </p>
        )}
        {usingLocalPassword && (
          <p style={{ fontSize: '12px', color: '#999', lineHeight: 1.6, marginBottom: '18px' }}>
            本地开发临时口令为 admin。部署前请在环境变量里设置 ADMIN_PASSWORD。
          </p>
        )}

        <button
          type="submit"
          disabled={!configured}
          style={{
            width: '100%',
            height: '42px',
            border: 'none',
            background: '#111',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: configured ? 'pointer' : 'not-allowed',
            opacity: configured ? 1 : 0.4,
          }}
        >
          登录后台
        </button>
      </form>
    </main>
  )
}
