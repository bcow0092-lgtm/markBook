import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { resolveAppPath } from '../../src/main/services/appPath'

const APP = 'C:\\appdata\\马克阅读器'

describe('resolveAppPath', () => {
  it('接受白名单目录内的正常路径', () => {
    expect(resolveAppPath(APP, '/books/a.epub')).toBe(resolve(APP, 'books/a.epub'))
    expect(resolveAppPath(APP, '/txt-cache/a.txt')).toBe(resolve(APP, 'txt-cache/a.txt'))
    expect(resolveAppPath(APP, '/books/.staging/a.epub')).toBe(
      resolve(APP, 'books/.staging/a.epub'),
    )
  })

  it('拒绝 ../ 穿越', () => {
    expect(resolveAppPath(APP, '/books/../../library.json')).toBeNull()
  })

  it('拒绝百分号编码的穿越', () => {
    expect(resolveAppPath(APP, '/books/%2e%2e/%2e%2e/library.json')).toBeNull()
  })

  it('拒绝反斜杠穿越', () => {
    expect(resolveAppPath(APP, '/books/..%5C..%5Clibrary.json')).toBeNull()
  })

  it('拒绝与白名单目录同前缀的兄弟目录', () => {
    expect(resolveAppPath(APP, '/books-evil/a.epub')).toBeNull()
  })

  it('拒绝白名单之外的顶层路径', () => {
    expect(resolveAppPath(APP, '/library.json')).toBeNull()
    expect(resolveAppPath(APP, '/')).toBeNull()
  })

  it('拒绝裸目录（必须以具体文件结尾）', () => {
    expect(resolveAppPath(APP, '/books')).toBeNull()
    expect(resolveAppPath(APP, '/books/')).toBeNull()
  })

  it('拒绝非法百分号编码', () => {
    expect(resolveAppPath(APP, '/books/%ZZ')).toBeNull()
  })

  it('拒绝含 NUL 字节的路径', () => {
    expect(resolveAppPath(APP, '/books/a\0.epub')).toBeNull()
  })
})
