import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNativeApp } from '../platform'

function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function backupFilename(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `cooking-journal-backup-${y}${m}${d}.json`
}

export async function shareOrDownloadBackup(json: string, filename: string): Promise<void> {
  if (isNativeApp()) {
    const path = `exports/${filename}`
    await Filesystem.writeFile({
      path,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    })
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache })
    try {
      await Share.share({
        title: '做菜手帐备份',
        files: [uri],
        dialogTitle: '导出手帐备份',
      })
    } finally {
      try {
        await Filesystem.deleteFile({ path, directory: Directory.Cache })
      } catch {
        /* cache leftover is acceptable */
      }
    }
    return
  }
  downloadTextFile(filename, json)
}
