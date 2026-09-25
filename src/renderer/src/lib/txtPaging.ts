import type { ChapterIndex } from '@shared/types'

/**
 * TXT 的页码 / 章节 / 字符偏移换算。
 *
 * 全是纯函数、不碰 DOM —— 分页本身依赖 Chromium 的多列布局，测它得起真实
 * 渲染环境；把这些换算剥出来，至少让「读到哪了」这件事有覆盖。
 */

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/** 全文字符偏移落在第几章。越界时夹到首尾，空表返回 -1 */
export function chapterIndexOf(chapters: ChapterIndex[], offset: number): number {
  if (chapters.length === 0) return -1
  if (offset <= chapters[0].start) return 0

  for (let i = 0; i < chapters.length; i++) {
    if (offset < chapters[i].end) return i
  }
  return chapters.length - 1
}

/**
 * 章节内的第几页对应哪个字符偏移。
 *
 * **这是近似值** —— 精确到页而不是精确到字符。要知道某一页的第一个字到底
 * 是哪个字符，得用 Range 去量列边界，对每次翻页都做一遍不值得。对进度显示
 * 足够：一个 5000 字的章分成 20 页，误差上限约 0.05% 全书。
 */
export function offsetFromPage(
  chapter: ChapterIndex,
  pageIndex: number,
  pageCount: number,
): number {
  const length = chapter.end - chapter.start
  if (pageCount <= 0 || length <= 0) return chapter.start
  const page = Math.min(pageCount - 1, Math.max(0, Math.floor(pageIndex)))
  // 分母用 pageCount 而不是 pageCount - 1：最后一页的起点不该是章节末尾
  return chapter.start + Math.round((length * page) / pageCount)
}

export function percentageFromOffset(offset: number, totalCharacters: number): number {
  if (totalCharacters <= 0) return 0
  return clamp01(offset / totalCharacters)
}

export function offsetFromPercentage(percentage: number, totalCharacters: number): number {
  if (totalCharacters <= 0) return 0
  return Math.round(clamp01(percentage) * totalCharacters)
}
