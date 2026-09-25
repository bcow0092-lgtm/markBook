import { describe, it, expect } from 'vitest'
import {
  chapterIndexOf,
  offsetFromPage,
  percentageFromOffset,
  offsetFromPercentage,
} from '../../src/renderer/src/lib/txtPaging'
import type { ChapterIndex } from '@shared/types'

/** 三章，长度分别是 100 / 200 / 300，首尾相接 */
const chapters: ChapterIndex[] = [
  { title: '一', start: 0, end: 100 },
  { title: '二', start: 100, end: 300 },
  { title: '三', start: 300, end: 600 },
]

describe('chapterIndexOf', () => {
  it('落在某章区间内时返回该章', () => {
    expect(chapterIndexOf(chapters, 150)).toBe(1)
  })

  it('正好在章节起点时返回该章而不是上一章', () => {
    expect(chapterIndexOf(chapters, 100)).toBe(1)
    expect(chapterIndexOf(chapters, 300)).toBe(2)
  })

  it('在最后一章的终点（等于全文长度）时返回最后一章', () => {
    expect(chapterIndexOf(chapters, 600)).toBe(2)
  })

  it('越界时夹到两端', () => {
    expect(chapterIndexOf(chapters, -10)).toBe(0)
    expect(chapterIndexOf(chapters, 99999)).toBe(2)
  })

  it('空章节表返回 -1', () => {
    expect(chapterIndexOf([], 0)).toBe(-1)
  })
})

describe('offsetFromPage', () => {
  const chapter: ChapterIndex = { title: 'x', start: 100, end: 300 }

  it('第一页落在章节起点', () => {
    expect(offsetFromPage(chapter, 0, 10)).toBe(100)
  })

  it('最后一页落在章节末尾之前', () => {
    const last = offsetFromPage(chapter, 9, 10)
    expect(last).toBeGreaterThan(100)
    expect(last).toBeLessThan(300)
  })

  it('页码越界时夹到合法范围', () => {
    expect(offsetFromPage(chapter, -3, 10)).toBe(100)
    expect(offsetFromPage(chapter, 99, 10)).toBeLessThan(300)
  })

  it('pageCount 为 0 时退回章节起点，不产生 NaN', () => {
    expect(offsetFromPage(chapter, 3, 0)).toBe(100)
  })

  it('页码递增时偏移单调不减', () => {
    let prev = -1
    for (let p = 0; p < 10; p++) {
      const cur = offsetFromPage(chapter, p, 10)
      expect(cur).toBeGreaterThanOrEqual(prev)
      prev = cur
    }
  })
})

describe('percentageFromOffset', () => {
  it('起点是 0，终点是 1', () => {
    expect(percentageFromOffset(0, 1000)).toBe(0)
    expect(percentageFromOffset(1000, 1000)).toBe(1)
  })

  it('中间值按比例', () => {
    expect(percentageFromOffset(250, 1000)).toBeCloseTo(0.25)
  })

  it('总长为 0 时返回 0，不产生 NaN', () => {
    expect(percentageFromOffset(0, 0)).toBe(0)
  })

  it('越界时夹到 [0, 1]', () => {
    expect(percentageFromOffset(-5, 1000)).toBe(0)
    expect(percentageFromOffset(9999, 1000)).toBe(1)
  })
})

describe('offsetFromPercentage', () => {
  it('与 percentageFromOffset 互为逆运算（整数情形）', () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      expect(percentageFromOffset(offsetFromPercentage(p, 800), 800)).toBeCloseTo(p)
    }
  })

  it('总长为 0 时返回 0，不产生 NaN', () => {
    expect(offsetFromPercentage(0.5, 0)).toBe(0)
  })

  it('越界时夹到 [0, 1]', () => {
    expect(offsetFromPercentage(-1, 1000)).toBe(0)
    expect(offsetFromPercentage(2, 1000)).toBe(1000)
  })
})
