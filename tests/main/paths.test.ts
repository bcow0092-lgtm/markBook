import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPaths, ensureDirs, clearStaging } from '../../src/main/services/paths'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mark-reader-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('createPaths', () => {
  it('所有目录都挂在给定的 root 下', () => {
    const p = createPaths(root)
    for (const dir of [p.books, p.txtCache, p.chapters, p.locations, p.covers, p.staging]) {
      expect(dir.startsWith(root)).toBe(true)
    }
  })

  it('staging 位于 books 之下，以便复用同一套白名单校验', () => {
    const p = createPaths(root)
    expect(p.staging.startsWith(p.books)).toBe(true)
  })
})

describe('ensureDirs', () => {
  it('创建全部目录，且可重复调用', async () => {
    const p = createPaths(root)
    await ensureDirs(p)
    await ensureDirs(p)
    for (const dir of [p.books, p.txtCache, p.chapters, p.locations, p.covers, p.staging]) {
      expect((await stat(dir)).isDirectory()).toBe(true)
    }
  })
})

describe('clearStaging', () => {
  it('清空 staging 内的残留文件', async () => {
    const p = createPaths(root)
    await ensureDirs(p)
    await writeFile(join(p.staging, 'a.epub'), 'x')
    await mkdir(join(p.staging, 'sub'), { recursive: true })
    await writeFile(join(p.staging, 'sub', 'b.txt'), 'y')

    await clearStaging(p)

    expect(await readdir(p.staging)).toEqual([])
  })

  it('目录不存在时不报错', async () => {
    const p = createPaths(root)
    await expect(clearStaging(p)).resolves.toBeUndefined()
  })

  it('不触碰 books/ 下的正式文件', async () => {
    const p = createPaths(root)
    await ensureDirs(p)
    await writeFile(join(p.books, 'kept.epub'), 'x')
    await writeFile(join(p.staging, 'gone.epub'), 'y')

    await clearStaging(p)

    // 注意别断言 readdir(books) 的完整内容：staging 本身就是 books/.staging，
    // 必然出现在结果里。这里断言的是「正式文件还在、staging 已空」。
    expect(await readdir(p.books)).toContain('kept.epub')
    expect(await readdir(p.staging)).toEqual([])
  })
})
