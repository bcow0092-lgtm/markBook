import { describe, it, expect } from 'vitest'
import { IPC, createEmptyLibrary, DEFAULT_READER_SETTINGS } from '@shared/types'
import type { Book } from '@shared/types'

describe('IPC 通道常量', () => {
  it('取值互不重复', () => {
    const values = Object.values(IPC)
    expect(new Set(values).size).toBe(values.length)
  })

  it('全部使用 命名空间:动作 的形式', () => {
    for (const v of Object.values(IPC)) {
      expect(v).toMatch(/^[a-z]+:[a-zA-Z]+$/)
    }
  })
})

describe('createEmptyLibrary', () => {
  it('产出版本号为 1 的空书架', () => {
    const lib = createEmptyLibrary()
    expect(lib.version).toBe(1)
    expect(lib.books).toEqual([])
  })

  it('每次调用返回独立对象，不共享引用', () => {
    const a = createEmptyLibrary()
    const b = createEmptyLibrary()
    const book: Book = {
      id: 'x',
      title: 't',
      author: 'a',
      format: 'epub',
      fileName: 'x.epub',
      coverFileName: null,
      size: 0,
      addedAt: 0,
      lastReadAt: null,
      progress: null,
      sourceEncoding: null,
      locationsReady: false,
    }
    a.books.push(book)
    expect(b.books).toEqual([])
  })

  it('带上默认阅读设置', () => {
    expect(createEmptyLibrary().settings).toEqual(DEFAULT_READER_SETTINGS)
  })

  it('返回的 settings 与默认值不是同一个对象', () => {
    const lib = createEmptyLibrary()
    lib.settings.fontSize = 99
    expect(DEFAULT_READER_SETTINGS.fontSize).not.toBe(99)
  })
})
