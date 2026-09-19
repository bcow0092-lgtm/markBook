import { randomUUID } from 'node:crypto'
import { basename, extname, join } from 'node:path'
import { readFile, writeFile, stat } from 'node:fs/promises'
import type {
  Book,
  BookFormat,
  ChapterFile,
  CommitPayload,
  ImportResult,
} from '@shared/types'
import type { AppContext } from './context'
import { decodeText } from './txt/encoding'
import { splitChapters } from './txt/chapters'

const SUPPORTED: BookFormat[] = ['epub', 'txt']

function parseFormat(srcPath: string): BookFormat {
  const ext = extname(srcPath).slice(1).toLowerCase()
  if (!SUPPORTED.includes(ext as BookFormat)) {
    throw new Error(`不支持的格式：${ext || '(无扩展名)'}，只支持 .epub 与 .txt`)
  }
  return ext as BookFormat
}

/**
 * 去掉扩展名作为书名兜底。
 *
 * 渲染进程侧有一份规则相同的实现（TXT 的常规路径走那边），两处要一起改。
 */
export function titleFromFileName(name: string): string {
  const base = basename(name)
  const ext = extname(base)
  return (ext ? base.slice(0, -ext.length) : base).trim() || '未命名'
}

/**
 * staging 期的描述符。
 *
 * commit 需要知道原始文件名（书名兜底）与原始编码，而这两样在
 * `{id}.epub` 这种文件名里都读不出来。写在 staging 而不是主进程内存里：
 * 渲染进程崩溃时内存就没了，而 staging 里的东西由 abort 与启动清理统一
 * 兜住，生命周期天然自洽（技术方案 §5.6）。
 */
interface StagedDescriptor {
  originalName: string
  format: BookFormat
  sourceEncoding: string | null
}

/**
 * 第一步：把源文件复制进 staging，TXT 顺带转码并切分章节。
 *
 * 不依赖 electron —— 文件对话框那类东西留在 ipc/ 层，于是这段逻辑能在
 * vitest 的 Node 环境下直接测。
 */
export async function importStaged(ctx: AppContext, srcPath: string): Promise<ImportResult> {
  const format = parseFormat(srcPath)
  const id = randomUUID()

  await ctx.files.stageFile(srcPath, id, format)

  let sourceEncoding: string | null = null
  if (format === 'txt') {
    const decoded = decodeText(await readFile(srcPath))
    sourceEncoding = decoded.encoding
    // 原样存下来：转码产物是派生物，原始字节另有保留（§4.1）
    await writeFile(join(ctx.paths.staging, `${id}.utf8.txt`), decoded.text, 'utf8')

    const split = splitChapters(decoded.text)
    const chapterFile: ChapterFile = {
      totalCharacters: split.totalCharacters,
      chapters: split.chapters,
    }
    await writeFile(
      join(ctx.paths.staging, `${id}.chapters.json`),
      JSON.stringify(chapterFile),
      'utf8',
    )
  }

  const descriptor: StagedDescriptor = {
    originalName: basename(srcPath),
    format,
    sourceEncoding,
  }
  await writeFile(
    join(ctx.paths.staging, `${id}.staged.json`),
    JSON.stringify(descriptor),
    'utf8',
  )

  return { id, format, originalName: descriptor.originalName, sourceEncoding }
}

/** 第二步：渲染进程解析出元数据后提交 */
export async function commitImport(
  ctx: AppContext,
  id: string,
  payload: CommitPayload,
): Promise<Book> {
  const descriptor = JSON.parse(
    await readFile(join(ctx.paths.staging, `${id}.staged.json`), 'utf8'),
  ) as StagedDescriptor

  const chapters =
    descriptor.format === 'txt'
      ? (JSON.parse(
          await readFile(join(ctx.paths.staging, `${id}.chapters.json`), 'utf8'),
        ) as ChapterFile)
      : undefined

  const result = await ctx.files.commit(id, descriptor.format, {
    sourceEncoding: descriptor.sourceEncoding,
    chapters,
    cover: payload.coverBase64
      ? { base64: payload.coverBase64, ext: payload.coverExt ?? 'png' }
      : null,
  })

  const book: Book = {
    id,
    // 主进程侧兜底：渲染进程传来的书名可能是空的（§11.1 的降级规则）
    title: payload.title.trim() || titleFromFileName(descriptor.originalName),
    author: payload.author.trim(),
    format: descriptor.format,
    fileName: result.fileName,
    coverFileName: result.coverFileName,
    size: (await stat(join(ctx.paths.books, result.fileName))).size,
    addedAt: Date.now(),
    lastReadAt: null,
    progress: null,
    sourceEncoding: result.sourceEncoding,
    // EPUB 的位置索引要等第一次打开才生成（§5.2）
    locationsReady: descriptor.format === 'txt',
  }

  await ctx.repo.upsertBook(book)
  await ctx.repo.flush()
  return book
}

export async function abortImport(ctx: AppContext, id: string): Promise<void> {
  await ctx.files.abort(id)
}

/**
 * 删除：先从 library.json 移除并落盘，再删文件（技术方案 §5.8）。
 *
 * 顺序不能反 —— 文件删了但写盘失败会留下一本点不开的僵尸书。
 */
export async function deleteBook(ctx: AppContext, id: string): Promise<void> {
  const book = ctx.repo.listBooks().find((b) => b.id === id)
  if (!book) return
  await ctx.repo.removeBook(id)
  await ctx.repo.flush()
  await ctx.files.remove(id, book.format, book.coverFileName)
}
