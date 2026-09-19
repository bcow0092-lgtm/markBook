import { describe, it, expect } from 'vitest'
import { splitChapters, FALLBACK_CHARS } from '../../src/main/services/txt/chapters'

/** 造一章：标题行 + bodyChars 个字的正文 + 空行 */
const chapter = (title: string, bodyChars: number): string =>
  `${title}\n${'文'.repeat(bodyChars)}\n\n`

const threeChapters = (): string =>
  chapter('第一章 起', 600) + chapter('第二章 承', 600) + chapter('第三章 转', 600)

describe('按标题切分', () => {
  it('识别中文数字章节', () => {
    const r = splitChapters(threeChapters())
    expect(r.degraded).toBe(false)
    expect(r.chapters.map((c) => c.title)).toEqual(['第一章 起', '第二章 承', '第三章 转'])
  })

  it('识别 Chapter N', () => {
    const text = chapter('Chapter 1', 600) + chapter('Chapter 2', 600) + chapter('Chapter 3', 600)
    const r = splitChapters(text)
    expect(r.degraded).toBe(false)
    expect(r.chapters).toHaveLength(3)
  })

  it('识别纯数字编号', () => {
    const text = chapter('1. 开始', 600) + chapter('2、继续', 600) + chapter('3. 结束', 600)
    const r = splitChapters(text)
    expect(r.degraded).toBe(false)
    expect(r.chapters).toHaveLength(3)
  })

  it('三位以上数字的章节号也能识别', () => {
    let text = ''
    for (let i = 1; i <= 12; i++) text += chapter(`第${i}章`, 600)
    const r = splitChapters(text)
    expect(r.degraded).toBe(false)
    expect(r.chapters).toHaveLength(12)
    expect(r.chapters[9].title).toBe('第10章')
  })

  it('章节区间首尾相接，覆盖全文', () => {
    const text = threeChapters()
    const r = splitChapters(text)
    expect(r.chapters[0].start).toBe(0)
    expect(r.chapters.at(-1)!.end).toBe(text.length)
    for (let i = 1; i < r.chapters.length; i++) {
      expect(r.chapters[i].start).toBe(r.chapters[i - 1].end)
    }
  })

  it('totalCharacters 等于全文长度', () => {
    expect(splitChapters(threeChapters()).totalCharacters).toBe(threeChapters().length)
  })
})

describe('正文里的章节字样不该被误判', () => {
  it('句中出现的「第三章」不算标题', () => {
    const body = `他第三章还没读完，因为那一章写得太枯燥了。${'文'.repeat(600)}`
    const text = `第一章 起\n${body}\n\n第二章 承\n${'文'.repeat(600)}\n\n第三章 转\n${'文'.repeat(600)}`
    const r = splitChapters(text)
    expect(r.degraded).toBe(false)
    expect(r.chapters).toHaveLength(3)
    expect(r.chapters.every((c) => !c.title.includes('还没读完'))).toBe(true)
  })

  it('过长的一行即使以「第X章」开头也不算标题', () => {
    const longLine = `第三章${'字'.repeat(80)}`
    const text = `第一章 起\n${'文'.repeat(600)}\n\n第二章 承\n${'文'.repeat(600)}\n\n${longLine}\n${'文'.repeat(600)}`
    const r = splitChapters(text)
    expect(r.chapters.every((c) => c.title !== longLine)).toBe(true)
  })
})

describe('降级判定', () => {
  it('章节数少于 3 时降级', () => {
    const text = chapter('第一章 起', 6000) + chapter('第二章 承', 6000)
    const r = splitChapters(text)
    expect(r.degraded).toBe(true)
    // 降级后仍要产出可用的目录
    expect(r.chapters.length).toBeGreaterThanOrEqual(2)
  })

  it('完全没有章节标题时按固定字数等分', () => {
    const text = '文'.repeat(FALLBACK_CHARS * 3 + 100)
    const r = splitChapters(text)
    expect(r.degraded).toBe(true)
    expect(r.chapters).toHaveLength(4)
    expect(r.chapters[0].end - r.chapters[0].start).toBe(FALLBACK_CHARS)
  })

  it('降级后的章节首尾相接', () => {
    const text = '文'.repeat(FALLBACK_CHARS * 2 + 50)
    const r = splitChapters(text)
    expect(r.chapters[0].start).toBe(0)
    expect(r.chapters.at(-1)!.end).toBe(text.length)
    for (let i = 1; i < r.chapters.length; i++) {
      expect(r.chapters[i].start).toBe(r.chapters[i - 1].end)
    }
  })

  it('平均章节过短时降级', () => {
    let text = ''
    for (let i = 1; i <= 40; i++) text += `第${i}章\n${'文'.repeat(50)}\n\n`
    expect(splitChapters(text).degraded).toBe(true)
  })

  it('空文件不抛异常', () => {
    const r = splitChapters('')
    expect(r.totalCharacters).toBe(0)
    expect(r.chapters).toEqual([])
    expect(r.degraded).toBe(false)
  })
})
