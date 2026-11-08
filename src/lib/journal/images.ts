const DATA_IMAGE =
  /^data:image\/(jpeg|jpg|png|gif|webp|pjpeg)(;charset=[^;,]+)?;base64,/i

const BUNDLED_FILE =
  /^(food|backgrounds)\/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|jpeg|png|gif|webp)$/i

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function stripBasePrefix(path: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  if (base && base !== '/' && (path === base || path.startsWith(`${base}/`))) {
    return path.slice(base.length)
  }
  return path
}

export function isBundledAssetPath(path: string, baseUrl = '/'): boolean {
  if (typeof path !== 'string' || path.length === 0 || path.length > 400) return false
  let p = path.trim()
  if (!p) return false
  if (p.includes('\\') || p.includes('\0')) return false
  if (/[\u0000-\u001f]/.test(p)) return false
  if (/%2e/i.test(p) || p.includes('..')) return false
  if (p.includes('?') || p.includes('#') || p.includes(':')) return false
  if (p.startsWith('./')) p = p.slice(2)
  p = stripBasePrefix(p, baseUrl)
  p = p.replace(/^\/+/, '')
  if (p.includes('..') || p.includes('//')) return false
  return BUNDLED_FILE.test(p)
}

export function isAllowedImageSrc(src: unknown, baseUrl = '/'): boolean {
  if (typeof src !== 'string') return false
  if (src.length === 0 || src.length > 10_000_000) return false
  const trimmed = src.trim()
  if (!trimmed) return false
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(trimmed)) return false
  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text') ||
    lower.startsWith('data:image/svg') ||
    lower.startsWith('blob:') ||
    lower.startsWith('file:')
  ) {
    return false
  }
  if (lower.includes('<script') || lower.includes('onerror=')) return false
  if (trimmed.startsWith('//')) return false

  if (DATA_IMAGE.test(trimmed)) return true

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    try {
      const u = new URL(trimmed)
      if (u.username || u.password) return false
      if (u.protocol !== 'https:' && u.protocol !== 'capacitor:') return false
      if (!LOCAL_HOSTS.has(u.hostname.toLowerCase())) return false
      return isBundledAssetPath(u.pathname, baseUrl)
    } catch {
      return false
    }
  }

  return isBundledAssetPath(trimmed, baseUrl)
}

export function sanitizeImageList(photos: unknown, baseUrl = '/'): string[] {
  if (!Array.isArray(photos)) return []
  return photos.filter((src): src is string => isAllowedImageSrc(src, baseUrl))
}
