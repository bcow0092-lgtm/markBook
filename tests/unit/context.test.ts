import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContext } from '../../src/main/services/context'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mark-reader-ctx-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('createContext', () => {
  it('建好全部目录', async () => {
    const ctx = await createContext(root)
    for (const dir of [ctx.paths.books, ctx.paths.txtCache, ctx.paths.locations]) {
      await expect(readdir(dir)).resolves.toBeDefined()
    }
    expect((await readdir(root)).sort()).toEqual(
      ['books', 'chapters', 'covers', 'locations', 'txt-cache'].sort(),
    )
  })

  it('仓储已加载，初始为空书架', async () => {
    const ctx = await createContext(root)
    expect(ctx.repo.listBooks()).toEqual([])
  })

  it('启动时清空 staging 里的残留', async () => {
    const first = await createContext(root)
    await writeFile(join(first.paths.staging, 'orphan.epub'), 'x')

    const ctx = await createContext(root)

    expect(await readdir(ctx.paths.staging)).toEqual([])
  })

  it('能读回上一次落盘的书', async () => {
    const first = await createContext(root)
    await first.repo.upsertBook({
      id: 'a',
      title: '书',
      author: '作者',
      format: 'epub',
      fileName: 'a.epub',
      coverFileName: null,
      size: 1,
      addedAt: 1,
      lastReadAt: null,
      progress: null,
      sourceEncoding: null,
      locationsReady: false,
    })
    await first.repo.flush()

    const ctx = await createContext(root)

    expect(ctx.repo.listBooks().map((b) => b.id)).toEqual(['a'])
  })
})
