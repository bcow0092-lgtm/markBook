import { copyFile, rename, writeFile, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { BookFormat, ChapterFile } from '@shared/types'
import type { AppPaths } from './paths'

export interface CommitExtras {
  sourceEncoding?: string | null
  chapters?: ChapterFile
  cover?: { base64: string; ext: string } | null
}

export interface CommitResult {
  fileName: string
  coverFileName: string | null
  sourceEncoding: string | null
}

export interface BookFiles {
  /** 把源文件复制进 staging，返回 staging 内的路径 */
  stageFile(srcPath: string, id: string, format: BookFormat): Promise<string>
  /** 原子提交：把 staging 的产物搬到正式位置（技术方案 §5.6） */
  commit(id: string, format: BookFormat, extras: CommitExtras): Promise<CommitResult>
  /** 导入失败时清理该 id 在 staging 下的全部产物 */
  abort(id: string): Promise<void>
  /** 删书时清理全部派生物（技术方案 §5.8） */
  remove(id: string, format: BookFormat, coverFileName: string | null): Promise<void>
}

/** 删除单个文件，不存在时静默忽略 */
async function rmQuiet(path: string): Promise<void> {
  await rm(path, { force: true }).catch(() => {})
}

export function createBookFiles(paths: AppPaths): BookFiles {
  const stagedOriginal = (id: string, format: BookFormat): string =>
    join(paths.staging, `${id}.${format}`)
  const stagedUtf8 = (id: string): string => join(paths.staging, `${id}.utf8.txt`)

  return {
    async stageFile(srcPath, id, format) {
      const dest = stagedOriginal(id, format)
      await copyFile(srcPath, dest)
      return dest
    },

    async commit(id, format, extras) {
      const fileName = `${id}.${format}`
      const from = stagedOriginal(id, format)
      const to = join(paths.books, fileName)

      // 源文件不在 staging 说明这一步之前就失败了，直接抛错而不是产生半成品
      await rename(from, to)

      let coverFileName: string | null = null
      if (extras.cover) {
        coverFileName = `${id}.${extras.cover.ext}`
        await mkdir(paths.covers, { recursive: true })
        await writeFile(
          join(paths.covers, coverFileName),
          Buffer.from(extras.cover.base64, 'base64'),
        )
      }

      if (format === 'txt') {
        await rename(stagedUtf8(id), join(paths.txtCache, `${id}.txt`))
        if (extras.chapters) {
          await mkdir(paths.chapters, { recursive: true })
          await writeFile(
            join(paths.chapters, `${id}.json`),
            JSON.stringify(extras.chapters),
            'utf8',
          )
        }
      }

      return {
        fileName,
        coverFileName,
        sourceEncoding: format === 'txt' ? (extras.sourceEncoding ?? null) : null,
      }
    },

    async abort(id) {
      await rmQuiet(stagedOriginal(id, 'epub'))
      await rmQuiet(stagedOriginal(id, 'txt'))
      await rmQuiet(stagedUtf8(id))
    },

    async remove(id, format, coverFileName) {
      await rmQuiet(join(paths.books, `${id}.${format}`))
      await rmQuiet(join(paths.locations, `${id}.json`))
      if (coverFileName) await rmQuiet(join(paths.covers, coverFileName))
      if (format === 'txt') {
        await rmQuiet(join(paths.txtCache, `${id}.txt`))
        await rmQuiet(join(paths.chapters, `${id}.json`))
      }
    },
  }
}
