import type { ChapterFile, ReaderSettings, ReadingProgress } from '@shared/types'
import { PAGE_MARGIN_PX } from '../../lib/readerSettings'
import { findCurrentChapter, seekTarget, type IndexedTocEntry } from '../../lib/readerProgress'
import {
  chapterIndexOf,
  offsetFromPage,
  offsetFromPercentage,
  percentageFromOffset,
} from '../../lib/txtPaging'
import type { EngineOptions, ReaderEngine } from './engine'

/** 列间距。与 §7.1 的实测数据一致（600px 列 + 40px 间距） */
const GAP = 40

/**
 * TXT 阅读引擎。分页用 CSS 多列布局，翻页靠 translateX（技术方案 §5.4）。
 *
 * DOM 里**只放当前章**。一次性 fetch 全文没问题 —— 内存里留个几十 MB 的
 * 字符串不是瓶颈，真正的瓶颈是几十万个 DOM 节点。初版设计写的是「挂载
 * 当前章节 ±1」，实现时发现对 TXT 不成立：多列布局的分页是按整个内容
 * 容器算的，三章塞进同一个容器会让「本章最后一页」的判断失效。
 */
export function createTxtEngine(opts: EngineOptions): ReaderEngine {
  const viewport = document.createElement('div')
  viewport.className = 'txt-viewport'
  const columns = document.createElement('div')
  columns.className = 'txt-columns'
  viewport.appendChild(columns)
  opts.container.appendChild(viewport)

  let chapters: ChapterFile = { totalCharacters: 0, chapters: [] }
  let text = ''
  let toc: IndexedTocEntry[] = []
  let currentChapter = 0
  let pageIndex = 0
  let pageCount = 1
  let destroyed = false

  /** 每页宽 = 视口宽。必须与 column-width 严格相等，否则浏览器会拉伸列宽填满 */
  const pageWidth = (): number => Math.max(1, viewport.clientWidth)
  const pageHeight = (): number => Math.max(1, viewport.clientHeight)

  /**
   * 把几何尺寸写进样式。
   *
   * §5.4 的三个约束缺一不可：容器宽高各固定为一页、column-width 与容器
   * 内容宽严格相等、column-fill: auto。
   */
  function applyGeometry(): void {
    columns.style.width = `${pageWidth()}px`
    columns.style.height = `${pageHeight()}px`
    columns.style.columnWidth = `${pageWidth()}px`
    columns.style.columnGap = `${GAP}px`
  }

  /** 列数 = (scrollWidth + gap) / (pageWidth + gap)，与 §7.1 实测的算法一致 */
  function measurePages(): void {
    pageCount = Math.max(1, Math.round((columns.scrollWidth + GAP) / (pageWidth() + GAP)))
    if (pageIndex > pageCount - 1) pageIndex = pageCount - 1
  }

  function paint(): void {
    columns.style.transform = `translateX(-${(pageWidth() + GAP) * pageIndex}px)`
  }

  function renderChapter(): void {
    const ch = chapters.chapters[currentChapter]
    if (!ch) {
      columns.textContent = '（空文件）'
      pageCount = 1
      pageIndex = 0
      return
    }

    // 每个非空行算一段：中文小说是「一段一行」，段首缩进两字、段间留白
    const fragment = document.createDocumentFragment()
    for (const line of text.slice(ch.start, ch.end).split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      const p = document.createElement('p')
      p.textContent = trimmed
      fragment.appendChild(p)
    }
    columns.replaceChildren(fragment)

    applyGeometry()
    measurePages()
    paint()
  }

  function currentOffset(): number {
    const ch = chapters.chapters[currentChapter]
    if (!ch) return 0
    return offsetFromPage(ch, pageIndex, pageCount)
  }

  function emitProgress(): void {
    if (destroyed) return
    const offset = currentOffset()
    const chapter = findCurrentChapter(toc, currentChapter)
    const progress: ReadingProgress = {
      location: offset,
      percentage: percentageFromOffset(offset, chapters.totalCharacters),
      // TXT 的进度由字符偏移直接算出，不依赖任何后台索引，没有估算态
      percentageExact: true,
      chapterIndex: chapter.tocIndex,
      chapterTitle: chapter.title,
    }
    opts.callbacks.onRelocated(progress)
  }

  /** 切到某一章并渲染。与接口方法 goToChapter 分开命名，免得里外看混 */
  function switchChapter(index: number, page = 0): void {
    if (index < 0 || index >= chapters.chapters.length) return
    currentChapter = index
    pageIndex = page
    renderChapter()
    emitProgress()
  }

  return {
    async load(book, location) {
      const [rawText, rawChapters] = await Promise.all([
        fetch(`app://local/txt-cache/${book.id}.txt`).then((r) => r.text()),
        fetch(`app://local/chapters/${book.id}.json`).then(
          (r) => r.json() as Promise<ChapterFile>,
        ),
      ])
      if (destroyed) return

      text = rawText
      chapters = rawChapters
      toc = chapters.chapters.map((c, i) => ({ title: c.title, index: i }))
      opts.callbacks.onToc(toc)

      // 用调用方传来的 location 而不是 book.progress —— 接口就是这么约定的，
      // 恢复到哪里由调用方决定
      const offset = typeof location === 'number' ? location : 0
      switchChapter(Math.max(0, chapterIndexOf(chapters.chapters, offset)))
    },

    prev() {
      if (pageIndex > 0) {
        pageIndex--
        paint()
        emitProgress()
        return
      }
      // 本章第一页再往前 = 上一章的最后一页
      const prevChapter = currentChapter - 1
      if (prevChapter < 0) return
      switchChapter(prevChapter)
      pageIndex = Math.max(0, pageCount - 1)
      paint()
      emitProgress()
    },

    next() {
      if (pageIndex < pageCount - 1) {
        pageIndex++
        paint()
        emitProgress()
        return
      }
      // 本章最后一页再往后 = 下一章的第一页
      if (currentChapter + 1 >= chapters.chapters.length) return
      switchChapter(currentChapter + 1, 0)
    },

    goToChapter(index) {
      switchChapter(index, 0)
    },

    goToLocation(location) {
      if (typeof location !== 'number') return
      switchChapter(Math.max(0, chapterIndexOf(chapters.chapters, location)))
    },

    goToPercentage(percentage) {
      // locationsReady 传 true：TXT 的进度由字符偏移直接算出，永远不需要
      // EPUB 那套「索引未就绪就按章节粗跳」的降级
      const target = seekTarget(percentage, {
        locationsReady: true,
        spineLength: chapters.chapters.length,
      })
      if (target.kind !== 'percentage') return
      const offset = offsetFromPercentage(target.percentage, chapters.totalCharacters)
      switchChapter(Math.max(0, chapterIndexOf(chapters.chapters, offset)))
    },

    resize() {
      applyGeometry()
      measurePages()
      paint()
    },

    applySettings(settings: ReaderSettings) {
      columns.style.fontSize = `${settings.fontSize}px`
      columns.style.lineHeight = String(settings.lineHeight)
      // 页边距做成段落的左右 padding，而不是把容器变窄再居中：列几何与页宽
      // 严格绑定（§5.4 的约束），变窄再居中会让翻页时相邻列从留白区露出来
      columns.style.setProperty('--txt-margin', `${PAGE_MARGIN_PX[settings.pageMargin]}px`)

      // 位置保持：记住当前字符偏移，重排后回到它所在的页。这是近似值 ——
      // 与 txtPaging 的页码换算同一套取舍，误差上限是一页宽度
      const keep = currentOffset()
      applyGeometry()
      measurePages()

      const ch = chapters.chapters[currentChapter]
      if (ch) {
        const length = ch.end - ch.start
        const ratio = length > 0 ? (keep - ch.start) / length : 0
        pageIndex = Math.min(pageCount - 1, Math.max(0, Math.round(ratio * pageCount)))
      }

      paint()
      emitProgress()
    },

    locationsReady: () => true,

    destroy() {
      destroyed = true
      viewport.remove()
    },
  }
}
