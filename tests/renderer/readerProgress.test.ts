import { describe, it, expect } from 'vitest'
import {
  estimatePercentage,
  seekTarget,
  findCurrentChapter,
  type IndexedTocEntry,
} from '../../src/renderer/src/lib/readerProgress'

describe('estimatePercentage —— 位置索引未就绪时的降级估算', () => {
  it('第 0 章不是 0%，而是已过 1/n', () => {
    // 用 (index + 1) / length 而不是 index / length：读到第一章时进度条
    // 不该还停在 0
    expect(estimatePercentage(0, 10)).toBeCloseTo(0.1)
  })

  it('最后一章是 100%', () => {
    expect(estimatePercentage(9, 10)).toBeCloseTo(1)
  })

  it('spine 为空时返回 0，不产生 NaN', () => {
    expect(estimatePercentage(0, 0)).toBe(0)
  })

  it('下标越界时被夹到 [0, 1]', () => {
    expect(estimatePercentage(99, 10)).toBe(1)
    expect(estimatePercentage(-1, 10)).toBe(0)
  })
})

describe('seekTarget —— 拖拽跳转的目标决策', () => {
  it('索引就绪时按百分比精确定位', () => {
    expect(seekTarget(0.42, { locationsReady: true, spineLength: 10 })).toEqual({
      kind: 'percentage',
      percentage: 0.42,
    })
  })

  it('索引未就绪时按章节比例粗跳', () => {
    expect(seekTarget(0.42, { locationsReady: false, spineLength: 10 })).toEqual({
      kind: 'spine',
      index: 4,
    })
  })

  it('索引未就绪且拖到最后时跳到最后一章', () => {
    expect(seekTarget(1, { locationsReady: false, spineLength: 10 })).toEqual({
      kind: 'spine',
      index: 9,
    })
  })

  it('拖到 1 时不越界成「第 11 章」', () => {
    const t = seekTarget(1, { locationsReady: false, spineLength: 10 })
    if (t.kind === 'spine') expect(t.index).toBeLessThan(10)
  })

  it('入参越界时先夹到 [0, 1]', () => {
    expect(seekTarget(-5, { locationsReady: true, spineLength: 10 })).toEqual({
      kind: 'percentage',
      percentage: 0,
    })
    expect(seekTarget(5, { locationsReady: true, spineLength: 10 })).toEqual({
      kind: 'percentage',
      percentage: 1,
    })
  })

  it('spine 为空时给一个安全的兜底目标', () => {
    expect(seekTarget(0.5, { locationsReady: false, spineLength: 0 })).toEqual({
      kind: 'spine',
      index: 0,
    })
  })

  it('索引就绪但 spine 为空时仍走百分比分支（不产生越界下标）', () => {
    expect(seekTarget(0.5, { locationsReady: true, spineLength: 0 })).toEqual({
      kind: 'spine',
      index: 0,
    })
  })
})

describe('findCurrentChapter', () => {
  const toc: IndexedTocEntry[] = [
    { title: '第一章', spineIndex: 0 },
    { title: '第二章', spineIndex: 3 },
    { title: '第三章', spineIndex: 7 },
  ]

  it('落在某一章的区间内时取该章', () => {
    expect(findCurrentChapter(toc, 4)).toEqual({ index: 1, title: '第二章' })
  })

  it('正好在章节起点时取该章', () => {
    expect(findCurrentChapter(toc, 3)).toEqual({ index: 1, title: '第二章' })
  })

  it('在第一章之前时返回空', () => {
    expect(findCurrentChapter(toc, -1)).toEqual({ index: -1, title: '' })
  })

  it('在最后一章之后时取最后一章', () => {
    expect(findCurrentChapter(toc, 99)).toEqual({ index: 2, title: '第三章' })
  })

  it('跳过 spine 序号为 -1 的项（目录里有指向不存在章节的条目）', () => {
    const dirty: IndexedTocEntry[] = [
      { title: '坏的', spineIndex: -1 },
      { title: '好的', spineIndex: 2 },
    ]
    expect(findCurrentChapter(dirty, 5)).toEqual({ index: 1, title: '好的' })
  })

  it('空目录不抛异常', () => {
    expect(findCurrentChapter([], 3)).toEqual({ index: -1, title: '' })
  })
})
