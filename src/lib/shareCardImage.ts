import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNativeApp } from './platform'

export type ShareCardPayload = {
  name: string
  coverSrc: string
  meta: string
  tags: string[]
  excerpt: string
  pit?: { title: string; body: string }
  stamp: { month: string; day: string; year: string }
}

function loadImage(src: string, timeoutMs = 8000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const timer = window.setTimeout(() => reject(new Error('timeout')), timeoutMs)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('image'))
    }
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous'
    img.src = src
  })
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const ch of para) {
      const next = line + ch
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line)
        line = ch
      } else {
        line = next
      }
    }
    lines.push(line)
  }
  return lines
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function coverCrop(img: HTMLImageElement, aspect: number) {
  const iw = Math.max(1, img.naturalWidth || img.width)
  const ih = Math.max(1, img.naturalHeight || img.height)
  const ia = iw / ih
  if (ia > aspect) {
    const sw = ih * aspect
    return { sx: (iw - sw) / 2, sy: 0, sw, sh: ih }
  }
  const sh = iw / aspect
  return { sx: 0, sy: (ih - sh) / 2, sw: iw, sh }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('blob'))
    }, 'image/png')
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('read'))
    reader.readAsDataURL(blob)
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Rasterize the on-screen card (foreignObject). Throws if the canvas would be tainted or empty. */
export async function captureElementPng(el: HTMLElement, scale = 2): Promise<Blob> {
  const width = Math.ceil(el.scrollWidth || el.offsetWidth)
  const height = Math.ceil(el.scrollHeight || el.offsetHeight)
  if (width < 8 || height < 8) throw new Error('empty')

  const clone = el.cloneNode(true) as HTMLElement
  const srcImgs = el.querySelectorAll('img')
  const dstImgs = clone.querySelectorAll('img')
  for (let i = 0; i < dstImgs.length; i++) {
    const live = srcImgs[i]
    const dst = dstImgs[i]
    if (!live || !dst) continue
    const src = live.currentSrc || live.src
    if (!src) continue
    if (src.startsWith('data:')) {
      dst.setAttribute('src', src)
      continue
    }
    try {
      const loaded = live.complete && live.naturalWidth > 0 ? live : await loadImage(src)
      const c = document.createElement('canvas')
      c.width = loaded.naturalWidth || loaded.width
      c.height = loaded.naturalHeight || loaded.height
      const cx = c.getContext('2d')
      if (!cx) throw new Error('ctx')
      cx.drawImage(loaded, 0, 0)
      dst.setAttribute('src', c.toDataURL('image/jpeg', 0.92))
    } catch {
      dst.setAttribute('src', src)
    }
  }

  const cssParts: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      cssParts.push(
        Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n'),
      )
    } catch {
      /* skip cross-origin sheets */
    }
  }

  const pad = 16
  const svgW = width + pad * 2
  const svgH = height + pad * 2
  const html = clone.outerHTML
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">` +
    `<foreignObject x="0" y="0" width="${svgW}" height="${svgH}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${svgW}px;height:${svgH}px;padding:${pad}px;background:transparent;box-sizing:border-box;">` +
    `<style>${cssParts.join('\n')}</style>${html}</div></foreignObject></svg>`

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)
  try {
    const img = await loadImage(svgUrl)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(svgW * scale)
    canvas.height = Math.round(svgH * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.fillStyle = '#EDE0CC'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await canvasToBlob(canvas)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

/** Draw a scrapbook card that matches share-dish-v1 when DOM capture is unavailable. */
export async function drawShareCardPng(p: ShareCardPayload): Promise<Blob> {
  const cover = p.coverSrc ? await loadImage(p.coverSrc).catch(() => null) : null

  const W = 1080
  const maxH = 2800
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = maxH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  const PAD = 56
  const innerW = W - PAD * 2
  const polaroidW = innerW * 0.82
  const polaroidPad = 24
  const imgW = polaroidW - polaroidPad * 2
  const imgH = imgW * (3 / 4)
  const polaroidBottom = 52
  const polaroidH = imgH + polaroidPad + polaroidBottom

  let y = 80

  ctx.font = '700 68px "Songti SC", "STSong", "Noto Serif SC", serif'
  const nameLines = wrapText(ctx, p.name, innerW - 24)
  ctx.font = '36px "PingFang SC", "Noto Sans SC", sans-serif'
  const excerptLines = wrapText(ctx, p.excerpt, innerW - 8).slice(0, 4)
  if (excerptLines.length === 4) {
    const last = excerptLines[3]
    excerptLines[3] = last.replace(/…$/, '').replace(/.{0,1}$/, '…')
  }

  let pitTitleLines: string[] = []
  let pitBodyLines: string[] = []
  if (p.pit) {
    ctx.font = '700 34px "Songti SC", "STSong", "Noto Serif SC", serif'
    pitTitleLines = wrapText(ctx, `踩过的坑 · ${p.pit.title}`, innerW - 72)
    if (p.pit.body) {
      ctx.font = '32px "PingFang SC", "Noto Sans SC", sans-serif'
      pitBodyLines = wrapText(ctx, p.pit.body, innerW - 72).slice(0, 3)
    }
  }

  const pitBlock = p.pit ? 36 + pitTitleLines.length * 46 + pitBodyLines.length * 44 + 28 : 0
  const brandH = 132

  ctx.fillStyle = '#FFFCFA'
  ctx.fillRect(0, 0, W, maxH)

  ctx.strokeStyle = 'rgba(180, 140, 100, 0.22)'
  ctx.lineWidth = 2
  for (let ly = 80; ly < maxH - 8; ly += 80) {
    ctx.beginPath()
    ctx.moveTo(0, ly)
    ctx.lineTo(W, ly)
    ctx.stroke()
  }

  ctx.save()
  ctx.translate(W / 2, 22)
  ctx.rotate((-2.5 * Math.PI) / 180)
  ctx.fillStyle = 'rgba(120, 160, 110, 0.72)'
  ctx.fillRect(-110, 0, 220, 44)
  ctx.restore()

  ctx.save()
  ctx.translate(W / 2, y + polaroidH / 2)
  ctx.rotate((-1.5 * Math.PI) / 180)
  ctx.fillStyle = '#FFFCFA'
  ctx.shadowColor = 'rgba(70, 48, 28, 0.18)'
  ctx.shadowBlur = 22
  ctx.shadowOffsetX = 6
  ctx.shadowOffsetY = 10
  ctx.fillRect(-polaroidW / 2, -polaroidH / 2, polaroidW, polaroidH)
  ctx.shadowColor = 'transparent'
  const imgX = -polaroidW / 2 + polaroidPad
  const imgY = -polaroidH / 2 + polaroidPad
  if (cover) {
    const crop = coverCrop(cover, 4 / 3)
    ctx.drawImage(cover, crop.sx, crop.sy, crop.sw, crop.sh, imgX, imgY, imgW, imgH)
  } else {
    ctx.fillStyle = '#E8D5B8'
    ctx.fillRect(imgX, imgY, imgW, imgH)
    ctx.fillStyle = '#9A7B63'
    ctx.font = '48px "Songti SC", "STSong", serif'
    ctx.textAlign = 'center'
    ctx.fillText('🍽', 0, imgY + imgH / 2 + 16)
  }
  ctx.restore()

  y += polaroidH + 40

  ctx.fillStyle = '#2A1C12'
  ctx.textAlign = 'center'
  ctx.font = '700 68px "Songti SC", "STSong", "Noto Serif SC", serif'
  for (const line of nameLines) {
    ctx.fillText(line, W / 2, y + 56)
    y += 82
  }

  ctx.font = '32px "PingFang SC", "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#9A7B63'
  ctx.fillText(p.meta, W / 2, y + 28)
  y += 60

  ctx.textAlign = 'left'
  ctx.font = '32px "PingFang SC", "Noto Sans SC", sans-serif'
  const tagGap = 16
  const tagPads = 22
  const tagHs = 48
  const tagWidths = p.tags.map((t) => ctx.measureText(t).width + tagPads * 2)
  const tagsW = tagWidths.reduce((s, w, i) => s + w + (i ? tagGap : 0), 0)
  let tx = (W - tagsW) / 2
  const tagY = y
  for (let i = 0; i < p.tags.length; i++) {
    const tw = tagWidths[i]
    ctx.save()
    ctx.translate(tx + tw / 2, tagY + tagHs / 2)
    ctx.rotate((-2 * Math.PI) / 180)
    ctx.strokeStyle = '#A67C52'
    ctx.lineWidth = 2.4
    ctx.fillStyle = 'rgba(255, 240, 220, 0.5)'
    roundRect(ctx, -tw / 2, -tagHs / 2, tw, tagHs, 4)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#A67C52'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(p.tags[i], 0, 1)
    ctx.restore()
    tx += tw + tagGap
  }
  y += p.tags.length ? 70 : 12

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#4A3828'
  ctx.font = '36px "PingFang SC", "Noto Sans SC", sans-serif'
  for (const line of excerptLines) {
    ctx.fillText(line, PAD + 4, y + 36)
    y += 56
  }
  y += 18

  if (p.pit) {
    ctx.save()
    ctx.translate(W / 2, y + pitBlock / 2)
    ctx.rotate((1 * Math.PI) / 180)
    ctx.fillStyle = '#FFF3A0'
    ctx.shadowColor = 'rgba(90, 70, 40, 0.14)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 6
    const pw = innerW - 12
    ctx.fillRect(-pw / 2, -pitBlock / 2, pw, pitBlock)
    ctx.shadowColor = 'transparent'
    ctx.textAlign = 'left'
    let py = -pitBlock / 2 + 44
    ctx.fillStyle = '#C45C48'
    ctx.font = '700 34px "Songti SC", "STSong", "Noto Serif SC", serif'
    for (const line of pitTitleLines) {
      ctx.fillText(line, -pw / 2 + 36, py)
      py += 46
    }
    ctx.fillStyle = '#5A4030'
    ctx.font = '32px "PingFang SC", "Noto Sans SC", sans-serif'
    for (const line of pitBodyLines) {
      ctx.fillText(line, -pw / 2 + 36, py)
      py += 44
    }
    ctx.restore()
    y += pitBlock + 20
  }

  const stripY = y
  const H = Math.min(maxH, Math.ceil(stripY + brandH))
  const stripH = H - stripY
  const grad = ctx.createLinearGradient(0, stripY, 0, H)
  grad.addColorStop(0, 'rgba(243, 230, 208, 0.35)')
  grad.addColorStop(1, 'rgba(243, 230, 208, 0.92)')
  ctx.fillStyle = grad
  ctx.fillRect(0, stripY, W, stripH)
  ctx.strokeStyle = 'rgba(180, 140, 100, 0.45)'
  ctx.setLineDash([10, 10])
  ctx.beginPath()
  ctx.moveTo(0, stripY)
  ctx.lineTo(W, stripY)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = '#C45C48'
  ctx.font = '700 40px "Songti SC", "STSong", "Noto Serif SC", serif'
  ctx.textAlign = 'left'
  ctx.fillText('厨房手帐', PAD, stripY + 78)

  const stampX = W - PAD - 70
  const stampY = stripY + stripH / 2
  ctx.save()
  ctx.translate(stampX, stampY)
  ctx.rotate((8 * Math.PI) / 180)
  ctx.strokeStyle = 'rgba(196, 92, 72, 0.55)'
  ctx.lineWidth = 3
  ctx.setLineDash([8, 7])
  ctx.beginPath()
  ctx.arc(0, 0, 58, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#C45C48'
  ctx.textAlign = 'center'
  ctx.font = '700 22px "PingFang SC", "Noto Sans SC", sans-serif'
  ctx.fillText(p.stamp.month, 0, -16)
  ctx.fillText(p.stamp.day, 0, 10)
  ctx.fillText(p.stamp.year, 0, 34)
  ctx.restore()

  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const ox = out.getContext('2d')
  if (!ox) throw new Error('canvas')
  ox.drawImage(canvas, 0, 0, W, H, 0, 0, W, H)
  return canvasToBlob(out)
}

export async function exportShareCardPng(
  el: HTMLElement | null,
  payload: ShareCardPayload,
): Promise<Blob> {
  if (el) {
    try {
      return await captureElementPng(el)
    } catch {
      /* canvas composition fallback */
    }
  }
  return drawShareCardPng(payload)
}

export function safePngFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, '').trim()
  return `${cleaned || 'kitchen-journal'}.png`
}

export async function savePngBlob(blob: Blob, filename: string): Promise<'saved' | 'shared'> {
  if (isNativeApp()) {
    const path = `exports/${filename}`
    const data = await blobToBase64(blob)
    await Filesystem.writeFile({
      path,
      data,
      directory: Directory.Cache,
      recursive: true,
    })
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache })
    try {
      await Share.share({
        title: '厨房手帐',
        files: [uri],
        dialogTitle: '保存图片',
      })
    } finally {
      try {
        await Filesystem.deleteFile({ path, directory: Directory.Cache })
      } catch {
        /* cache leftover is acceptable */
      }
    }
    return 'shared'
  }
  downloadBlob(blob, filename)
  return 'saved'
}
