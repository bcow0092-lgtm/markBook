import type { ChapterIndex } from '@shared/types'

export interface ChapterSplitResult {
  chapters: ChapterIndex[]
  totalCharacters: number
  degraded: boolean
}

/** 降级时按固定字数等分 */
export const FALLBACK_CHARS = 5000

/** 标题行最多这么长。超过就认为是一句话而不是标题。 */
const MAX_TITLE_LINE = 40

/**
 * 三条正则都要求**独占一行**。缺了行首行尾锚点的话，「他第三章还没读完」
 * 这类正文会被当成标题（技术方案 §5.4）。
 *
 * 第一条刻意不写成 `[^\n]{0,32}第…` 那种带前缀的形式 —— 那样要求「第」
 * 前面至少有一个字符，而「第一章 起」这种行首就是「第」的写法反而匹配
 * 不上，也就是绝大多数中文小说都切不出来。
 */
const PATTERNS: RegExp[] = [
  /^[ \t]*(第[一二三四五六七八九十百千零〇0-9]{1,8}[章节回卷篇][^\n]{0,20})[ \t]*$/gm,
  /^[ \t]*(Chapter\s+[0-9IVXLC]{1,6}[^\n]{0,30})[ \t]*$/gim,
  /^[ \t]*([0-9]{1,4}[.、][^\n]{0,30})[ \t]*$/gm,
]

// 降级阈值（技术方案 §5.4 的判定表）
const MIN_CHAPTERS = 3
const MAX_CHAPTERS = 1000
const MIN_AVG_LENGTH = 500

interface TitleHit {
  index: number
  title: string
}

function findTitles(text: string): TitleHit[] {
  const hits: TitleHit[] = []
  const seen = new Set<number>()

  for (const re of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const title = m[1].trim()
      if (title.length === 0 || title.length > MAX_TITLE_LINE) continue
      const index = m.index ?? 0
      if (seen.has(index)) continue
      seen.add(index)
      hits.push({ index, title })
    }
  }

  return hits.sort((a, b) => a.index - b.index)
}

function splitByTitles(text: string, hits: TitleHit[]): ChapterIndex[] {
  return hits.map((hit, i) => ({
    title: hit.title,
    start: hit.index,
    end: i + 1 < hits.length ? hits[i + 1].index : text.length,
  }))
}

function splitBySize(text: string, size = FALLBACK_CHARS): ChapterIndex[] {
  const out: ChapterIndex[] = []
  for (let start = 0; start < text.length; start += size) {
    out.push({
      title: `第 ${out.length + 1} 部分`,
      start,
      end: Math.min(start + size, text.length),
    })
  }
  return out
}

/**
 * 切分章节。命中标题但结果不可信时降级为按固定字数等分。
 *
 * 降级判定的三条规则见技术方案 §5.4，任一不满足即降级 —— 只写「匹配不到
 * 就降级」是不够的，误匹配出 2 个「章节」和正常切出 800 章是两种情况。
 */
export function splitChapters(text: string): ChapterSplitResult {
  const totalCharacters = text.length
  if (totalCharacters === 0) {
    return { chapters: [], totalCharacters: 0, degraded: false }
  }

  const hits = findTitles(text)
  const firstHit = hits[0]
  const plausible =
    hits.length >= MIN_CHAPTERS &&
    hits.length <= MAX_CHAPTERS &&
    firstHit !== undefined &&
    (totalCharacters - firstHit.index) / hits.length >= MIN_AVG_LENGTH

  if (plausible) {
    return { chapters: splitByTitles(text, hits), totalCharacters, degraded: false }
  }
  return { chapters: splitBySize(text), totalCharacters, degraded: true }
}
