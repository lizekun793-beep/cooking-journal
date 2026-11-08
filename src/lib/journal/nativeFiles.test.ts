import { describe, expect, it } from 'vitest'
import {
  FILESYSTEM_NOT_FOUND_CODE,
  createNativeFileStore,
  isFilesystemNotFoundError,
  type FilesystemApi,
} from './nativeFiles'

function pluginError(code: string, message: string) {
  return Object.assign(new Error(message), { code })
}

function mockFs(over: Partial<FilesystemApi> = {}): FilesystemApi {
  return {
    async readFile() {
      throw new Error('readFile not stubbed')
    },
    async writeFile() {
      throw new Error('writeFile not stubbed')
    },
    async copy() {
      throw new Error('copy not stubbed')
    },
    async rename() {
      throw new Error('rename not stubbed')
    },
    async deleteFile() {
      throw new Error('deleteFile not stubbed')
    },
    ...over,
  }
}

describe('isFilesystemNotFoundError', () => {
  it('accepts only Capacitor 8 OS-PLUG-FILE-0008', () => {
    expect(
      isFilesystemNotFoundError(
        pluginError(FILESYSTEM_NOT_FOUND_CODE, "'readFile' failed because file at 'x' does not exist."),
      ),
    ).toBe(true)
    expect(isFilesystemNotFoundError(pluginError('OS-PLUG-FILE-0006', 'Invalid path.'))).toBe(false)
    expect(isFilesystemNotFoundError(pluginError('OS-PLUG-FILE-0007', 'user denied permission request.'))).toBe(
      false,
    )
    expect(isFilesystemNotFoundError(pluginError('OS-PLUG-FILE-0013', 'readFile failed with: EIO'))).toBe(false)
    expect(isFilesystemNotFoundError(new Error('File does not exist.'))).toBe(false)
    expect(isFilesystemNotFoundError(new Error("'readFile' failed because file does not exist."))).toBe(false)
    expect(isFilesystemNotFoundError(null)).toBe(false)
    expect(isFilesystemNotFoundError('OS-PLUG-FILE-0008')).toBe(false)
  })
})

describe('createNativeFileStore.readUtf8', () => {
  it('returns null only for verified not-found', async () => {
    const store = createNativeFileStore(
      mockFs({
        async readFile() {
          throw pluginError(FILESYSTEM_NOT_FOUND_CODE, "'readFile' failed because file at 'journal/snapshot.json' does not exist.")
        },
      }),
    )
    await expect(store.readUtf8('journal/snapshot.json')).resolves.toBeNull()
  })

  it('propagates permission, I/O, and invalid-path errors', async () => {
    const permission = createNativeFileStore(
      mockFs({
        async readFile() {
          throw pluginError('OS-PLUG-FILE-0007', 'Unable to do file operation, user denied permission request.')
        },
      }),
    )
    await expect(permission.readUtf8('journal/snapshot.json')).rejects.toMatchObject({
      code: 'OS-PLUG-FILE-0007',
    })

    const io = createNativeFileStore(
      mockFs({
        async readFile() {
          throw pluginError('OS-PLUG-FILE-0013', "'readFile' failed with: EIO")
        },
      }),
    )
    await expect(io.readUtf8('journal/snapshot.json')).rejects.toMatchObject({ code: 'OS-PLUG-FILE-0013' })

    const unknown = createNativeFileStore(
      mockFs({
        async readFile() {
          throw new Error('disk ejected')
        },
      }),
    )
    await expect(unknown.readUtf8('journal/snapshot.json')).rejects.toThrow(/disk ejected/)
  })

  it('does not treat a non-text payload as a missing file', async () => {
    const store = createNativeFileStore(
      mockFs({
        async readFile() {
          return { data: new Blob(['x']) }
        },
      }),
    )
    await expect(store.readUtf8('journal/snapshot.json')).rejects.toThrow(/不是文本/)
  })
})
