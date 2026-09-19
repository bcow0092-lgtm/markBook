import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import iconv from 'iconv-lite'
import { createContext, type AppContext } from '../../src/main/services/context'
import {
  abortImport,
  commitImport,
  deleteBook,
  importStaged,
  titleFromFileName,
} from '../../src/main/services/library'

let root: string
let ctx: AppContext

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mark-reader-lib-'))
  ctx = await createContext(root)
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const writeSource = async (name: string, content: string | Buffer): Promise<string> => {
  const p = join(root, name)
  await writeFile(p, content)
  return p
}

const NOVEL = [
  `第一章 起\n${'文'.repeat(600)}`,
  `第二章 承\n${'文'.repeat(600)}`,
  `第三章 转\n${'文'.repeat(600)}`,
].join('\n\n')

describe('titleFromFileName', () => {
  it('去掉扩展名', () => {
    expect(titleFromFileName('吾辈是猫.txt')).toBe('吾辈是猫')
  })
  it('去掉路径', () => {
    expect(titleFromFileName('C:\\books\\吾辈是猫.txt')).toBe('吾辈是猫')
  })
  it('没有扩展名时原样返回', () => {
    expect(titleFromFileName('无名之书')).toBe('无名之书')
  })
  it('空名字回落到「未命名」', () => {
    expect(titleFromFileName('')).toBe('未命名')
    expect(titleFromFileName('   ')).toBe('未命名')
  })

  it('只有扩展名时原样返回 —— Node 把 .txt 当作没有扩展名的点文件', () => {
    expect(titleFromFileName('.txt')).toBe('.txt')
  })
})

describe('importStaged —— EPUB', () => {
  it('把源文件复制进 staging，返回 id / 格式 / 原文件名', async () => {
    const src = await writeSource('book.epub', 'EPUB')
    const r = await importStaged(ctx, src)

    expect(r.format).toBe('epub')
    expect(r.originalName).toBe('book.epub')
    expect(r.sourceEncoding).toBeNull()
    expect(await readFile(join(ctx.paths.staging, `${r.id}.epub`), 'utf8')).toBe('EPUB')
  })

  it('不写 library.json —— 提交之前书架不该看到它', async () => {
    const src = await writeSource('book.epub', 'EPUB')
    await importStaged(ctx, src)
    expect(ctx.repo.listBooks()).toEqual([])
  })

  it('扩展名大小写不敏感', async () => {
    const src = await writeSource('BOOK.EPUB', 'EPUB')
    expect((await importStaged(ctx, src)).format).toBe('epub')
  })

  it('拒绝不支持的扩展名', async () => {
    const src = await writeSource('x.pdf', 'PDF')
    await expect(importStaged(ctx, src)).rejects.toThrow()
  })

  it('写出 staged.json 描述符', async () => {
    const src = await writeSource('book.epub', 'EPUB')
    const r = await importStaged(ctx, src)
    const raw = await readFile(join(ctx.paths.staging, `${r.id}.staged.json`), 'utf8')
    expect(JSON.parse(raw)).toEqual({
      originalName: 'book.epub',
      format: 'epub',
      sourceEncoding: null,
    })
  })
})

describe('importStaged —— TXT', () => {
  it('转码成 UTF-8 写进 staging，并记下原始编码', async () => {
    const sample = '第一章 中文\n这是 GBK 编码的正文。'.repeat(20)
    const src = await writeSource('novel.txt', iconv.encode(sample, 'GBK'))

    const r = await importStaged(ctx, src)

    expect(r.format).toBe('txt')
    expect(r.sourceEncoding).toMatch(/GB/)
    const utf8 = await readFile(join(ctx.paths.staging, `${r.id}.utf8.txt`), 'utf8')
    expect(utf8).toContain('这是 GBK 编码的正文。')
  })

  it('同时写出章节索引到 staging', async () => {
    const src = await writeSource('novel.txt', Buffer.from(NOVEL, 'utf8'))
    const r = await importStaged(ctx, src)

    const raw = await readFile(join(ctx.paths.staging, `${r.id}.chapters.json`), 'utf8')
    expect(JSON.parse(raw).chapters).toHaveLength(3)
  })
})

describe('commitImport', () => {
  it('把 staging 的产物搬到正式位置并写入书架', async () => {
    const src = await writeSource('book.epub', 'EPUB')
    const staged = await importStaged(ctx, src)

    const book = await commitImport(ctx, staged.id, { title: '书名', author: '作者' })

    expect(book.title).toBe('书名')
    expect(book.author).toBe('作者')
    expect(book.format).toBe('epub')
    expect(book.size).toBe(4)
    expect(book.locationsReady).toBe(false)
    expect(ctx.repo.listBooks().map((b) => b.id)).toEqual([staged.id])
    expect(await readdir(ctx.paths.staging)).toEqual([])
    expect(await readFile(join(ctx.paths.books, `${staged.id}.epub`), 'utf8')).toBe('EPUB')
  })

  it('提交后落盘，新 context 能读回来', async () => {
    const src = await writeSource('book.epub', 'EPUB')
    const staged = await importStaged(ctx, src)
    await commitImport(ctx, staged.id, { title: '书名', author: '作者' })

    const reopened = await createContext(root)
    expect(reopened.repo.listBooks().map((b) => b.title)).toEqual(['书名'])
  })

  it('TXT 的章节索引落到 chapters/，且 locationsReady 为 true', async () => {
    const src = await writeSource('n.txt', Buffer.from(NOVEL, 'utf8'))
    const staged = await importStaged(ctx, src)

    const book = await commitImport(ctx, staged.id, { title: '标题', author: '' })

    expect(book.locationsReady).toBe(true)
    expect(book.sourceEncoding).toBe('UTF-8')
    const raw = await readFile(join(ctx.paths.chapters, `${staged.id}.json`), 'utf8')
    expect(JSON.parse(raw).chapters).toHaveLength(3)
    expect(await readFile(join(ctx.paths.txtCache, `${staged.id}.txt`), 'utf8')).toBe(NOVEL)
  })

  it('书名缺失时回落到原文件名（去扩展名）', async () => {
    const src = await writeSource('吾辈是猫.epub', 'EPUB')
    const staged = await importStaged(ctx, src)
    const book = await commitImport(ctx, staged.id, { title: '', author: '' })
    expect(book.title).toBe('吾辈是猫')
  })

  it('书名只有空白时同样回落', async () => {
    const src = await writeSource('吾辈是猫.epub', 'EPUB')
    const staged = await importStaged(ctx, src)
    const book = await commitImport(ctx, staged.id, { title: '   ', author: '' })
    expect(book.title).toBe('吾辈是猫')
  })

  it('作者缺失时回落为空串', async () => {
    const src = await writeSource('a.epub', 'EPUB')
    const staged = await importStaged(ctx, src)
    const book = await commitImport(ctx, staged.id, { title: 'T', author: '' })
    expect(book.author).toBe('')
  })

  it('封面按 base64 落盘', async () => {
    const src = await writeSource('a.epub', 'EPUB')
    const staged = await importStaged(ctx, src)
    const book = await commitImport(ctx, staged.id, {
      title: 'T',
      author: 'A',
      coverBase64: Buffer.from('PNG').toString('base64'),
      coverExt: 'png',
    })
    expect(book.coverFileName).toBe(`${staged.id}.png`)
    expect(await readFile(join(ctx.paths.covers, book.coverFileName!), 'utf8')).toBe('PNG')
  })

  it('没有封面时 coverFileName 为 null', async () => {
    const src = await writeSource('a.epub', 'EPUB')
    const staged = await importStaged(ctx, src)
    const book = await commitImport(ctx, staged.id, { title: 'T', author: 'A' })
    expect(book.coverFileName).toBeNull()
  })

  it('staged.json 不在时抛错，不产生半本书', async () => {
    await expect(commitImport(ctx, 'nope', { title: 'T', author: '' })).rejects.toThrow()
    expect(ctx.repo.listBooks()).toEqual([])
  })
})

describe('abortImport', () => {
  it('清掉 staging 里的全部产物，且不写书架', async () => {
    const src = await writeSource('n.txt', Buffer.from(NOVEL, 'utf8'))
    const staged = await importStaged(ctx, src)
    expect((await readdir(ctx.paths.staging)).length).toBeGreaterThan(1)

    await abortImport(ctx, staged.id)

    expect(await readdir(ctx.paths.staging)).toEqual([])
    expect(ctx.repo.listBooks()).toEqual([])
  })

  it('不影响其他正在导入的书', async () => {
    const a = await writeSource('a.txt', Buffer.from(NOVEL, 'utf8'))
    const b = await writeSource('b.txt', Buffer.from(NOVEL, 'utf8'))
    const stagedA = await importStaged(ctx, a)
    const stagedB = await importStaged(ctx, b)

    await abortImport(ctx, stagedA.id)

    const left = await readdir(ctx.paths.staging)
    expect(left.some((f) => f.startsWith(stagedB.id))).toBe(true)
    expect(left.some((f) => f.startsWith(stagedA.id))).toBe(false)
  })

  it('对不存在的 id 不报错', async () => {
    await expect(abortImport(ctx, 'nope')).resolves.toBeUndefined()
  })
})

describe('deleteBook', () => {
  it('清掉记录与全部派生物', async () => {
    const src = await writeSource('n.txt', Buffer.from(NOVEL, 'utf8'))
    const staged = await importStaged(ctx, src)
    const book = await commitImport(ctx, staged.id, {
      title: 'T',
      author: 'A',
      coverBase64: Buffer.from('PNG').toString('base64'),
      coverExt: 'png',
    })

    await deleteBook(ctx, staged.id)

    expect(ctx.repo.listBooks()).toEqual([])
    for (const p of [
      join(ctx.paths.books, book.fileName),
      join(ctx.paths.txtCache, `${staged.id}.txt`),
      join(ctx.paths.chapters, `${staged.id}.json`),
      join(ctx.paths.covers, book.coverFileName!),
    ]) {
      await expect(readFile(p)).rejects.toThrow()
    }
  })

  it('删除后落盘，新 context 读不到', async () => {
    const src = await writeSource('a.epub', 'EPUB')
    const staged = await importStaged(ctx, src)
    await commitImport(ctx, staged.id, { title: 'T', author: 'A' })
    await deleteBook(ctx, staged.id)

    const reopened = await createContext(root)
    expect(reopened.repo.listBooks()).toEqual([])
  })

  it('对不存在的 id 不报错', async () => {
    await expect(deleteBook(ctx, 'nope')).resolves.toBeUndefined()
  })
})
