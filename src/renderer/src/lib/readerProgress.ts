/**
 * 阅读进度的判断逻辑。
 *
 * 全部是纯函数、刻意不碰 epub.js —— 引擎本身难以单测（把它拉进 jsdom
 * 一个文件要多花 40 秒），把这些决策剥出来是让这部分有测试覆盖的唯一
 * 现实办法。
 */

/**
 * 位置索引未就绪时，按 spine 位置估算全书百分比。
 *
 * 只有 EPUB 走这条 —— TXT 的进度由字符偏移直接算出，永远不需要估算。
 */
export function estimatePercentage(spineIndex: number, spineLength: number): number {
  if (spineLength <= 0) return 0
  return clamp01((spineIndex + 1) / spineLength)
}

export type SeekTarget =
  | { kind: 'percentage'; percentage: number }
  | { kind: 'spine'; index: number }

/**
 * 拖拽跳转该往哪跳。
 *
 * 索引就绪时用百分比精确定位；未就绪时只能按章节比例粗跳 —— 这是可接受
 * 的降级，用户至少能跳到大致位置，而不是拖了没反应。
 */
export function seekTarget(
  percentage: number,
  opts: { locationsReady: boolean; spineLength: number },
): SeekTarget {
  const pct = clamp01(percentage)
  // spine 为空时两条路都走不通，给一个安全的兜底目标
  if (opts.spineLength <= 0) return { kind: 'spine', index: 0 }
  if (opts.locationsReady) return { kind: 'percentage', percentage: pct }
  return {
    kind: 'spine',
    index: Math.min(opts.spineLength - 1, Math.floor(pct * opts.spineLength)),
  }
}

/**
 * 目录项 + 它在正文里的位置。
 *
 * `index` 的含义随格式而变：EPUB 是 spine 序号，TXT 是章节序号。两者都是
 * 「越大越靠后」，所以 findCurrentChapter 的判据对两种格式都成立。
 * 取不到时记 -1。
 */
export interface IndexedTocEntry {
  title: string
  index: number
}

export interface ChapterRef {
  /**
   * 在传入的 toc 数组里的下标；没找到时为 -1。
   *
   * 刻意不叫 index —— 那会与 IndexedTocEntry.index（在正文里的位置）在
   * 同一个函数里撞名，两者含义完全不同。
   */
  tocIndex: number
  title: string
}

/**
 * 当前读到哪一章。
 *
 * 判据是正文位置：取所有「位置不晚于当前」的目录项里的最后一个。
 * 不用 href 字符串比较 —— 目录里的 href 常带锚点、且字符串序不等于阅读序。
 */
export function findCurrentChapter(toc: IndexedTocEntry[], currentIndex: number): ChapterRef {
  let found: ChapterRef = { tocIndex: -1, title: '' }
  for (let i = 0; i < toc.length; i++) {
    const entry = toc[i]
    if (entry.index < 0) continue
    if (entry.index > currentIndex) break
    found = { tocIndex: i, title: entry.title }
  }
  return found
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
}
