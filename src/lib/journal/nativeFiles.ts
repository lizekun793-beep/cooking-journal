import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import type { FileStore } from './types'

const DIR = Directory.Data

/** Capacitor 8 Filesystem `doesNotExist` / `fileNotFound` (Android + iOS). */
export const FILESYSTEM_NOT_FOUND_CODE = 'OS-PLUG-FILE-0008'

export type FilesystemApi = {
  readFile(options: {
    path: string
    directory: Directory
    encoding: Encoding
  }): Promise<{ data: string | Blob }>
  writeFile(options: {
    path: string
    data: string
    directory: Directory
    encoding: Encoding
    recursive: boolean
  }): Promise<unknown>
  copy(options: {
    from: string
    to: string
    directory: Directory
    toDirectory: Directory
  }): Promise<unknown>
  rename(options: {
    from: string
    to: string
    directory: Directory
    toDirectory: Directory
  }): Promise<void>
  deleteFile(options: { path: string; directory: Directory }): Promise<void>
}

export function isFilesystemNotFoundError(err: unknown): boolean {
  if (typeof err !== 'object' || err == null) return false
  if (!('code' in err)) return false
  return err.code === FILESYSTEM_NOT_FOUND_CODE
}

export function createNativeFileStore(fs: FilesystemApi = Filesystem): FileStore {
  return {
    async readUtf8(path: string): Promise<string | null> {
      try {
        const res = await fs.readFile({
          path,
          directory: DIR,
          encoding: Encoding.UTF8,
        })
        if (typeof res.data !== 'string') {
          throw new Error('本地快照不是文本，已停止读取以免误判为空。')
        }
        return res.data
      } catch (err) {
        if (isFilesystemNotFoundError(err)) return null
        throw err
      }
    },

    async writeUtf8(path: string, data: string): Promise<void> {
      await fs.writeFile({
        path,
        data,
        directory: DIR,
        encoding: Encoding.UTF8,
        recursive: true,
      })
    },

    async copy(from: string, to: string): Promise<void> {
      try {
        await fs.deleteFile({ path: to, directory: DIR })
      } catch (err) {
        if (!isFilesystemNotFoundError(err)) throw err
      }
      try {
        await fs.copy({
          from,
          to,
          directory: DIR,
          toDirectory: DIR,
        })
      } catch (err) {
        const data = await this.readUtf8(from)
        if (data == null) throw err
        await this.writeUtf8(to, data)
      }
    },

    async rename(from: string, to: string): Promise<void> {
      await fs.rename({
        from,
        to,
        directory: DIR,
        toDirectory: DIR,
      })
    },

    async remove(path: string): Promise<void> {
      try {
        await fs.deleteFile({ path, directory: DIR })
      } catch (err) {
        if (!isFilesystemNotFoundError(err)) throw err
      }
    },
  }
}

export const capacitorFileStore: FileStore = createNativeFileStore()
