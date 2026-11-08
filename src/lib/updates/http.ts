import { CapacitorHttp } from '@capacitor/core'
import { isNativeApp } from '../platform'
import { isAllowedReleaseUrl } from './urls'

export type HttpGetResult = { status: number; body: string; url?: string }

export type HttpGetInit = {
  timeoutMs: number
  headers?: Record<string, string>
}

export type HttpGet = (url: string, init: HttpGetInit) => Promise<HttpGetResult>

const MAX_HOPS = 5

function header(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined
  const needle = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === needle) return value
  }
  return undefined
}

export async function defaultHttpGet(
  url: string,
  init: HttpGetInit,
  hop = 0,
): Promise<HttpGetResult> {
  if (!isAllowedReleaseUrl(url)) throw new Error('blocked-url')
  if (hop > MAX_HOPS) throw new Error('blocked-redirect')

  if (isNativeApp()) {
    const res = await CapacitorHttp.get({
      url,
      headers: init.headers,
      connectTimeout: init.timeoutMs,
      readTimeout: init.timeoutMs,
      disableRedirects: true,
      responseType: 'text',
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = header(res.headers, 'location')
      if (!loc) return { status: res.status, body: '', url: res.url }
      const next = new URL(loc, url).href
      if (!isAllowedReleaseUrl(next)) throw new Error('blocked-redirect')
      return defaultHttpGet(next, init, hop + 1)
    }
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '')
    if (res.url && res.url !== url && !isAllowedReleaseUrl(res.url)) {
      throw new Error('blocked-redirect')
    }
    return { status: res.status, body, url: res.url }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: init.headers,
      signal: ctrl.signal,
      redirect: 'manual',
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return { status: res.status, body: '', url: res.url }
      const next = new URL(loc, url).href
      if (!isAllowedReleaseUrl(next)) throw new Error('blocked-redirect')
      return defaultHttpGet(next, init, hop + 1)
    }
    if (res.url && res.url !== url && !isAllowedReleaseUrl(res.url)) {
      throw new Error('blocked-redirect')
    }
    return { status: res.status, body: await res.text(), url: res.url }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('timeout')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
