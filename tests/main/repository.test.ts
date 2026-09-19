import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRepository } from '../../src/main/services/repository'
import type { Book } from '@shared/types'

let root: string
let file: string

const makeBook = (id: string): Book => ({
  id,
  title: `书 ${id}`,
  author: '作者',
  format: 'epub',
  fileName: `${id}.epub`,
  coverFileName: null,
  size: 1,
  addedAt: 1,
  lastReadAt: null,
  progress: null,
  sourceEncoding: null,
  locationsReady: false,
})

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mark-reader-repo-'))
  file = join(root, 'library.json')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('首次加载', () => {
  it('文件不存在时产出空书架', async () => {
    const repo = createRepository(file)
    await repo.load()
    expect(repo.listBooks()).toEqual([])
  })

  it('文件不存在时不创建文件', async () => {
    const repo = createRepository(file)
    await repo.load()
    await expect(readFile(file, 'utf8')).rejects.toThrow()
  })
})

describe('读写', () => {
  it('upsert 之后可以读回', async () => {
    const repo = createRepository(file)
    await repo.load()
    await repo.upsertBook(makeBook('a'))
    await repo.flush()
    expect(repo.listBooks().map((b) => b.id)).toEqual(['a'])
  })

  it('落盘后可被新实例读回', async () => {
    const repo1 = createRepository(file)
    await repo1.load()
    await repo1.upsertBook(makeBook('a'))
    await repo1.flush()

    const repo2 = createRepository(file)
    await repo2.load()
    expect(repo2.listBooks().map((b) => b.id)).toEqual(['a'])
  })

  it('同 id 的 upsert 是覆盖而非追加', async () => {
    const repo = createRepository(file)
    await repo.load()
    await repo.upsertBook(makeBook('a'))
    await repo.upsertBook({ ...makeBook('a'), title: '改过' })
    expect(repo.listBooks()).toHaveLength(1)
    expect(repo.listBooks()[0].title).toBe('改过')
  })

  it('removeBook 删掉对应记录', async () => {
    const repo = createRepository(file)
    await repo.load()
    await repo.upsertBook(makeBook('a'))
    await repo.upsertBook(makeBook('b'))
    await repo.removeBook('a')
    expect(repo.listBooks().map((b) => b.id)).toEqual(['b'])
  })

  it('removeBook 对不存在的 id 不报错', async () => {
    const repo = createRepository(file)
    await repo.load()
    await expect(repo.removeBook('nope')).resolves.toBeUndefined()
  })

  it('设置可读写', async () => {
    const repo = createRepository(file)
    await repo.load()
    await repo.saveSettings({ fontSize: 22, lineHeight: 2.0, pageMargin: 'wide' })
    expect(repo.getSettings()).toEqual({ fontSize: 22, lineHeight: 2.0, pageMargin: 'wide' })
  })
})

describe('损坏文件的容错', () => {
  it('JSON 语法错误时降级为空书架，不抛异常', async () => {
    await writeFile(file, '{ 这不是合法 JSON')
    const repo = createRepository(file)
    await expect(repo.load()).resolves.toBeUndefined()
    expect(repo.listBooks()).toEqual([])
  })

  it('结构不合法（books 不是数组）时降级为空书架', async () => {
    await writeFile(file, JSON.stringify({ version: 1, books: 'oops', settings: {} }))
    const repo = createRepository(file)
    await repo.load()
    expect(repo.listBooks()).toEqual([])
  })

  it('缺少 settings 时补上默认值', async () => {
    await writeFile(file, JSON.stringify({ version: 1, books: [] }))
    const repo = createRepository(file)
    await repo.load()
    expect(repo.getSettings()).toEqual({ fontSize: 18, lineHeight: 1.8, pageMargin: 'medium' })
  })

  it('损坏的文件被改名为 .corrupt 留档，不静默丢弃', async () => {
    await writeFile(file, '{ 坏')
    const repo = createRepository(file)
    await repo.load()
    await expect(readFile(file + '.corrupt', 'utf8')).resolves.toBe('{ 坏')
  })
})

describe('防抖落盘', () => {
  it('防抖窗口内不落盘，窗口结束后自动落一次', async () => {
    const repo = createRepository(file, { debounceMs: 20 })
    await repo.load()
    await repo.upsertBook(makeBook('a'))

    await expect(readFile(file, 'utf8')).rejects.toThrow() // 窗口内还没落盘
    await new Promise((r) => setTimeout(r, 150))
    const data = JSON.parse(await readFile(file, 'utf8'))
    expect(data.books.map((b: Book) => b.id)).toEqual(['a'])
  })

  it('连续 upsert 合并成一次写入', async () => {
    // 防抖窗口设得极长，确保三次 upsert 一定落在同一个窗口内，测试不依赖机器快慢
    const repo = createRepository(file, { debounceMs: 10_000 })
    await repo.load()
    await repo.upsertBook(makeBook('a'))
    await repo.upsertBook(makeBook('b'))
    await repo.upsertBook(makeBook('c'))

    await expect(readFile(file, 'utf8')).rejects.toThrow()
    await repo.flush()
    const after = JSON.parse(await readFile(file, 'utf8'))
    expect(after.books).toHaveLength(3)
  })

  it('flush 立即落盘', async () => {
    const repo = createRepository(file, { debounceMs: 10_000 })
    await repo.load()
    await repo.upsertBook(makeBook('a'))
    await repo.flush()
    const data = JSON.parse(await readFile(file, 'utf8'))
    expect(data.books.map((b: Book) => b.id)).toEqual(['a'])
  })
})
