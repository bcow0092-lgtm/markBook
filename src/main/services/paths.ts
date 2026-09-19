import { join } from 'node:path'
import { mkdir, rm, readdir, stat } from 'node:fs/promises'

export interface AppPaths {
  root: string
  libraryFile: string
  books: string
  /** 导入中转区。放在 books 之下，从而复用同一套 app:// 白名单校验（技术方案 §5.6） */
  staging: string
  txtCache: string
  chapters: string
  locations: string
  covers: string
}

export function createPaths(root: string): AppPaths {
  const books = join(root, 'books')
  return {
    root,
    libraryFile: join(root, 'library.json'),
    books,
    staging: join(books, '.staging'),
    txtCache: join(root, 'txt-cache'),
    chapters: join(root, 'chapters'),
    locations: join(root, 'locations'),
    covers: join(root, 'covers'),
  }
}

export async function ensureDirs(p: AppPaths): Promise<void> {
  for (const dir of [p.books, p.staging, p.txtCache, p.chapters, p.locations, p.covers]) {
    await mkdir(dir, { recursive: true })
  }
}

/**
 * 清空导入中转区。在应用启动时调用 —— 上次运行若中途崩溃，
 * staging 里会留下半成品文件（技术方案 §5.6）。
 */
export async function clearStaging(p: AppPaths): Promise<void> {
  try {
    await stat(p.staging)
  } catch {
    return // 目录还不存在
  }
  for (const entry of await readdir(p.staging)) {
    await rm(join(p.staging, entry), { recursive: true, force: true })
  }
}
