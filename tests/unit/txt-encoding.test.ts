import { describe, it, expect } from 'vitest'
import iconv from 'iconv-lite'
import { decodeText, detectEncoding } from '../../src/main/services/txt/encoding'

const SAMPLE = '第一章 中文测试\n这是一段用于验证编码检测的中文文本，包含标点：，。！？'

describe('detectEncoding', () => {
  it('识别带 BOM 的 UTF-8', () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(SAMPLE, 'utf8')])
    expect(detectEncoding(buf)).toBe('UTF-8')
  })

  it('识别不带 BOM 的 UTF-8', () => {
    expect(detectEncoding(Buffer.from(SAMPLE, 'utf8'))).toBe('UTF-8')
  })

  it('识别 GBK', () => {
    expect(detectEncoding(iconv.encode(SAMPLE, 'GBK'))).toMatch(/^(GBK|GB2312|GB18030)$/)
  })

  it('识别 GB18030', () => {
    expect(detectEncoding(iconv.encode(SAMPLE, 'GB18030'))).toMatch(/^(GBK|GB2312|GB18030)$/)
  })

  it('纯 ASCII 不会崩', () => {
    expect(detectEncoding(Buffer.from('plain ascii text'))).toBeTruthy()
  })

  it('空 Buffer 不会崩', () => {
    expect(detectEncoding(Buffer.alloc(0))).toBeTruthy()
  })

  it('识别 UTF-16LE 的 BOM', () => {
    const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('中文', 'utf16le')])
    expect(detectEncoding(buf)).toBe('UTF-16LE')
  })
})

describe('decodeText', () => {
  it('UTF-8 往返一致', () => {
    expect(decodeText(Buffer.from(SAMPLE, 'utf8')).text).toBe(SAMPLE)
  })

  it('GBK 往返一致', () => {
    expect(decodeText(iconv.encode(SAMPLE, 'GBK')).text).toBe(SAMPLE)
  })

  it('GB18030 往返一致', () => {
    expect(decodeText(iconv.encode(SAMPLE, 'GB18030')).text).toBe(SAMPLE)
  })

  it('强制指定编码时覆盖检测结果', () => {
    const r = decodeText(Buffer.from(SAMPLE, 'utf8'), 'GBK')
    expect(r.encoding).toBe('GBK')
    expect(r.text).not.toBe(SAMPLE)
  })

  it('剥掉 UTF-8 BOM，正文首字符不是 U+FEFF', () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(SAMPLE, 'utf8')])
    const r = decodeText(buf)
    expect(r.text.charCodeAt(0)).not.toBe(0xfeff)
    expect(r.text).toBe(SAMPLE)
  })

  it('空 Buffer 返回空串', () => {
    expect(decodeText(Buffer.alloc(0)).text).toBe('')
  })

  it('返回的 encoding 是实际使用的那个', () => {
    expect(decodeText(iconv.encode(SAMPLE, 'GBK')).encoding).toMatch(/^GB/)
  })
})
