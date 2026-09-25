import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContext, type AppContext } from '../../src/main/services/context'
import { readLocations, writeLocations } from '../../src/main/services/locations'

let root: string
let ctx: AppContext

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mark-reader-loc-'))
  ctx = await createContext(root)
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('readLocations', () => {
  it('文件不存在时返回 null，不抛异常', async () => {
    await expect(readLocations(ctx, 'nope')).resolves.toBeNull()
  })
})

describe('writeLocations', () => {
  it('写进 locations/{id}.json，可原样读回', async () => {
    const json = JSON.stringify(['cfi1', 'cfi2'])
    await writeLocations(ctx, 'id1', json)

    expect(await readFile(join(ctx.paths.locations, 'id1.json'), 'utf8')).toBe(json)
    expect(await readLocations(ctx, 'id1')).toBe(json)
  })

  it('重复写覆盖旧值', async () => {
    await writeLocations(ctx, 'id1', JSON.stringify(['a']))
    await writeLocations(ctx, 'id1', JSON.stringify(['b']))
    expect(await readLocations(ctx, 'id1')).toBe(JSON.stringify(['b']))
  })

  it('目录不存在时会建出来', async () => {
    await rm(ctx.paths.locations, { recursive: true, force: true })
    await expect(writeLocations(ctx, 'id1', '[]')).resolves.toBeUndefined()
    expect(await readLocations(ctx, 'id1')).toBe('[]')
  })
})

describe('id 校验', () => {
  it('拒绝含路径分隔符的 id，防穿越', async () => {
    await expect(writeLocations(ctx, '../evil', '[]')).rejects.toThrow()
    await expect(readLocations(ctx, '../evil')).rejects.toThrow()
  })

  it('拒绝反斜杠与空 id', async () => {
    await expect(readLocations(ctx, 'a\\b')).rejects.toThrow()
    await expect(readLocations(ctx, '')).rejects.toThrow()
  })
})
