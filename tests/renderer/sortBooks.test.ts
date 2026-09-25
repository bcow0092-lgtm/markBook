import { describe, it, expect } from 'vitest'
import { sortByRecentRead } from '../../src/renderer/src/lib/sortBooks'
import type { Book } from '@shared/types'

const book = (over: Partial<Book>): Book => ({
  id: 'x',
  title: 't',
  author: '',
  format: 'epub',
  fileName: 'x.epub',
  coverFileName: null,
  size: 1,
  addedAt: 0,
  lastReadAt: null,
  progress: null,
  sourceEncoding: null,
  locationsReady: true,
  ...over,
})

describe('sortByRecentRead', () => {
  it('读过的排在没读过的前面', () => {
    const read = book({ id: 'read', lastReadAt: 100 })
    const unread = book({ id: 'unread', addedAt: 999 })
    expect(sortByRecentRead([unread, read]).map((b) => b.id)).toEqual(['read', 'unread'])
  })

  it('读过的按 lastReadAt 降序', () => {
    const a = book({ id: 'a', lastReadAt: 100 })
    const b = book({ id: 'b', lastReadAt: 300 })
    const c = book({ id: 'c', lastReadAt: 200 })
    expect(sortByRecentRead([a, b, c]).map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('没读过的按加入时间降序（新导入的在上面）', () => {
    const a = book({ id: 'a', addedAt: 100 })
    const b = book({ id: 'b', addedAt: 300 })
    expect(sortByRecentRead([a, b]).map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('新导入的书不会挤掉正在读的', () => {
    const reading = book({ id: 'reading', lastReadAt: 1, addedAt: 1 })
    const fresh = book({ id: 'fresh', addedAt: 999_999 })
    expect(sortByRecentRead([fresh, reading]).map((b) => b.id)).toEqual(['reading', 'fresh'])
  })

  it('不修改传入的数组', () => {
    const input = [book({ id: 'a', lastReadAt: 1 }), book({ id: 'b', lastReadAt: 2 })]
    const before = input.map((b) => b.id)
    sortByRecentRead(input)
    expect(input.map((b) => b.id)).toEqual(before)
  })

  it('空数组不抛异常', () => {
    expect(sortByRecentRead([])).toEqual([])
  })

  it('lastReadAt 相同时两个都在，不丢书', () => {
    const a = book({ id: 'a', lastReadAt: 100 })
    const b = book({ id: 'b', lastReadAt: 100 })
    const out = sortByRecentRead([a, b]).map((x) => x.id)
    expect(out).toHaveLength(2)
    expect(out).toContain('a')
    expect(out).toContain('b')
  })
})
