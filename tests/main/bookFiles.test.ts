import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPaths, ensureDirs, type AppPaths } from '../../src/main/services/paths'
import { createBookFiles } from '../../src/main/services/bookFiles'

let root: string
let paths: AppPaths
let src: string // 模拟用户选中的源文件

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mark-reader-files-'))
  paths = createPaths(root)
  await ensureDirs(paths)
  src = join(root, 'source.epub')
  await writeFile(src, 'EPUB-BYTES')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const exists = async (p: string): Promise<boolean> =>
  stat(p).then(
    () => true,
    () => false,
  )

describe('stageFile', () => {
  it('把源文件复制到 staging，不动源文件', async () => {
    const bf = createBookFiles(paths)
    const staged = await bf.stageFile(src, 'id1', 'epub')
    expect(staged).toBe(join(paths.staging, 'id1.epub'))
    expect(await readFile(staged, 'utf8')).toBe('EPUB-BYTES')
    expect(await exists(src)).toBe(true)
  })
})

describe('commit', () => {
  it('把 staging 的文件搬到 books/ 正式位置', async () => {
    const bf = createBookFiles(paths)
    await bf.stageFile(src, 'id1', 'epub')
    await bf.commit('id1', 'epub', {})

    expect(await exists(join(paths.books, 'id1.epub'))).toBe(true)
    expect(await exists(join(paths.staging, 'id1.epub'))).toBe(false)
  })

  it('提交 TXT 时同时搬走转码产物并写入章节索引', async () => {
    const bf = createBookFiles(paths)
    await bf.stageFile(src, 'id2', 'txt')
    await writeFile(join(paths.staging, 'id2.utf8.txt'), '转码后的正文')

    const result = await bf.commit('id2', 'txt', {
      sourceEncoding: 'GBK',
      chapters: { totalCharacters: 6, chapters: [] },
    })

    expect(result.sourceEncoding).toBe('GBK')
    expect(await readFile(join(paths.books, 'id2.txt'), 'utf8')).toBe('EPUB-BYTES')
    expect(await readFile(join(paths.txtCache, 'id2.txt'), 'utf8')).toBe('转码后的正文')
    expect(await exists(join(paths.chapters, 'id2.json'))).toBe(true)
  })

  it('提交 EPUB 时写入封面', async () => {
    const bf = createBookFiles(paths)
    await bf.stageFile(src, 'id3', 'epub')
    const result = await bf.commit('id3', 'epub', {
      cover: { base64: Buffer.from('PNG').toString('base64'), ext: 'png' },
    })

    expect(result.coverFileName).toBe('id3.png')
    expect(await readFile(join(paths.covers, 'id3.png'), 'utf8')).toBe('PNG')
    expect(result.sourceEncoding).toBeNull()
  })

  it('没有封面时 coverFileName 为 null，也不创建文件', async () => {
    const bf = createBookFiles(paths)
    await bf.stageFile(src, 'id4', 'epub')
    const result = await bf.commit('id4', 'epub', {})
    expect(result.coverFileName).toBeNull()
  })

  it('staging 里没有对应文件时抛错，不产生半成品', async () => {
    const bf = createBookFiles(paths)
    await expect(bf.commit('nope', 'epub', {})).rejects.toThrow()
    expect(await exists(join(paths.books, 'nope.epub'))).toBe(false)
  })
})

describe('abort', () => {
  it('清掉该 id 在 staging 下的全部产物', async () => {
    const bf = createBookFiles(paths)
    await bf.stageFile(src, 'id5', 'txt')
    await writeFile(join(paths.staging, 'id5.utf8.txt'), 'x')

    await bf.abort('id5')

    expect(await exists(join(paths.staging, 'id5.txt'))).toBe(false)
    expect(await exists(join(paths.staging, 'id5.utf8.txt'))).toBe(false)
  })

  it('不影响其他 id 的 staging 文件', async () => {
    const bf = createBookFiles(paths)
    await bf.stageFile(src, 'keep', 'epub')
    await bf.stageFile(src, 'drop', 'epub')
    await bf.abort('drop')
    expect(await exists(join(paths.staging, 'keep.epub'))).toBe(true)
  })

  it('对不存在的 id 不报错', async () => {
    const bf = createBookFiles(paths)
    await expect(bf.abort('nope')).resolves.toBeUndefined()
  })
})

describe('remove', () => {
  it('删除一本书的全部派生物', async () => {
    const bf = createBookFiles(paths)
    await bf.stageFile(src, 'id6', 'txt')
    await writeFile(join(paths.staging, 'id6.utf8.txt'), '正文')
    await bf.commit('id6', 'txt', {
      sourceEncoding: 'UTF-8',
      chapters: { totalCharacters: 2, chapters: [] },
    })
    await writeFile(join(paths.locations, 'id6.json'), '[]')

    await bf.remove('id6', 'txt', null)

    expect(await exists(join(paths.books, 'id6.txt'))).toBe(false)
    expect(await exists(join(paths.txtCache, 'id6.txt'))).toBe(false)
    expect(await exists(join(paths.chapters, 'id6.json'))).toBe(false)
    expect(await exists(join(paths.locations, 'id6.json'))).toBe(false)
  })

  it('EPUB 的封面一并删除', async () => {
    const bf = createBookFiles(paths)
    await bf.stageFile(src, 'id7', 'epub')
    await bf.commit('id7', 'epub', {
      cover: { base64: Buffer.from('PNG').toString('base64'), ext: 'png' },
    })
    await bf.remove('id7', 'epub', 'id7.png')
    expect(await exists(join(paths.covers, 'id7.png'))).toBe(false)
  })

  it('文件已不存在时不报错', async () => {
    const bf = createBookFiles(paths)
    await expect(bf.remove('ghost', 'epub', null)).resolves.toBeUndefined()
  })
})
