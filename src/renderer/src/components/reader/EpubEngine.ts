import ePub from 'epubjs'
import type { ReadingProgress } from '@shared/types'
import {
  estimatePercentage,
  findCurrentChapter,
  seekTarget,
  type IndexedTocEntry,
} from '../../lib/readerProgress'
import type { EngineOptions, ReaderEngine } from './engine'

/**
 * 表格兜底（技术方案 §8）。实测宽表格在分页模式下会横向溢出页面 —— 15 列
 * 的表溢出约 1.9 倍，源书自带的 204 单元格大表溢出约 9.8 倍。包一层可横向
 * 滚动的容器，内容至少完整可见，而不是被裁掉。
 */
const TABLE_FALLBACK_CSS = `
.epub-table-scroll { overflow-x: auto; max-width: 100%; }
.epub-table-scroll > table { max-width: none; }
`

// epubjs 0.3.93 的 d.ts 不完整：下面这些成员运行时都存在但没声明。
// 与其到处 `as any`，不如集中成几个局部类型断言，至少把用到的形状写清楚。
type SpineLike = { length: number; get(target: unknown): { index?: number; href?: string } | undefined }
type LocationsLike = {
  load(json: string): void
  save(): string
  generate(chars: number): Promise<unknown>
  length(): number
  percentageFromCfi(cfi: string): number
  cfiFromPercentage(pct: number): string
}
type TocNode = { label?: string; href?: string; subitems?: TocNode[] }
type ContentsLike = { document: Document }
type RelocatedLike = { start?: { cfi?: string; index?: number } }

export function createEpubEngine(opts: EngineOptions): ReaderEngine {
  let book: ReturnType<typeof ePub> | null = null
  let rendition: ReturnType<ReturnType<typeof ePub>['renderTo']> | null = null
  let toc: IndexedTocEntry[] = []
  let spineLength = 0
  let indexReady = false
  let destroyed = false

  const spineOf = (b: ReturnType<typeof ePub>): SpineLike => b.spine as unknown as SpineLike
  const locationsOf = (b: ReturnType<typeof ePub>): LocationsLike =>
    b.locations as unknown as LocationsLike

  function currentProgress(spineIndex: number, cfi: string): ReadingProgress {
    const chapter = findCurrentChapter(toc, spineIndex)
    const raw =
      indexReady && book
        ? locationsOf(book).percentageFromCfi(cfi)
        : estimatePercentage(spineIndex, spineLength)
    return {
      location: cfi,
      // percentageFromCfi 对越界的 cfi 会返回 NaN
      percentage: Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0,
      percentageExact: indexReady,
      chapterIndex: chapter.index,
      chapterTitle: chapter.title,
    }
  }

  /** 索引生成完成后用它重发一次进度，让 UI 从 ~35% 收敛到 35% */
  function reemitWithExactPercentage(): void {
    if (!rendition || destroyed) return
    const loc = rendition.currentLocation() as RelocatedLike | undefined
    if (!loc?.start?.cfi) return
    opts.callbacks.onRelocated(currentProgress(loc.start.index ?? 0, loc.start.cfi))
  }

  async function setupLocations(): Promise<void> {
    const b = book
    if (!b) return
    const saved = await opts.loadLocations().catch(() => null)
    if (destroyed || !book) return

    if (saved) {
      try {
        locationsOf(b).load(saved)
        indexReady = true
        reemitWithExactPercentage()
        return
      } catch {
        // 索引文件坏了就当没有，落到下面重新生成
      }
    }

    // 后台生成，首屏不等它（§5.2）。生成期间进度走 estimatePercentage。
    void locationsOf(b)
      .generate(1024)
      .then(async () => {
        if (destroyed || !book) return
        indexReady = true
        reemitWithExactPercentage()
        await opts.saveLocations(locationsOf(b).save()).catch(() => {})
      })
      .catch(() => {
        // 生成失败就一直是估算模式，不该让阅读本身崩掉
      })
  }

  /** 给章节文档注入表格兜底。epub.js 每渲染一个章节都会调它 */
  function handleContent(contents: ContentsLike): void {
    const doc = contents.document
    const style = doc.createElement('style')
    style.textContent = TABLE_FALLBACK_CSS
    doc.head?.appendChild(style)

    for (const table of Array.from(doc.querySelectorAll('table'))) {
      if (table.parentElement?.classList.contains('epub-table-scroll')) continue
      const wrap = doc.createElement('div')
      wrap.className = 'epub-table-scroll'
      table.parentNode?.insertBefore(wrap, table)
      wrap.appendChild(table)
    }
  }

  /** epub.js 的 display 在畸形书上不 settle（§7.1），不 await、只兜住拒绝 */
  const display = (target?: string): void => {
    void rendition?.display(target).catch(() => {})
  }

  return {
    async load(bookRecord, location) {
      const b = ePub(`app://local/books/${bookRecord.fileName}`)
      book = b
      rendition = b.renderTo(opts.container, {
        flow: 'paginated',
        spread: 'none',
        width: '100%',
        height: '100%',
      })

      ;(rendition.hooks.content as unknown as { register(fn: unknown): void }).register(
        handleContent,
      )

      spineLength = spineOf(b).length ?? 0

      rendition.on('relocated', (loc: unknown) => {
        const start = (loc as RelocatedLike).start
        if (!start?.cfi) return
        opts.callbacks.onRelocated(currentProgress(start.index ?? 0, start.cfi))
      })

      display(location === null ? undefined : String(location))

      const nav = await b.loaded.navigation
      toc = flattenToc((nav.toc ?? []) as TocNode[], (t) => spineOf(b).get(t))
      opts.callbacks.onToc(toc)

      void setupLocations()
    },

    prev: () => {
      void rendition?.prev().catch(() => {})
    },

    next: () => {
      void rendition?.next().catch(() => {})
    },

    goToChapter(index) {
      const entry = toc[index]
      if (!entry || entry.spineIndex < 0 || !book) return
      // 用 spine 里的 href 而不是目录项原始的 — 后者常带锚点
      const section = spineOf(book).get(entry.spineIndex)
      if (section?.href) display(section.href)
    },

    goToLocation(location) {
      display(String(location))
    },

    goToPercentage(percentage) {
      if (!book) return
      const target = seekTarget(percentage, { locationsReady: indexReady, spineLength })
      if (target.kind === 'percentage') {
        const cfi = locationsOf(book).cfiFromPercentage(target.percentage)
        if (cfi) display(cfi)
        return
      }
      const section = spineOf(book).get(target.index)
      if (section?.href) display(section.href)
    },

    resize: () => {
      // 显式传容器尺寸而不是空调用：epubjs 的签名要求两个参数，
      // 而且传略比让它自己猜更可控
      const el = opts.container
      void rendition?.resize(el.clientWidth, el.clientHeight)
    },

    locationsReady: () => indexReady,

    destroy() {
      destroyed = true
      try {
        book?.destroy()
      } catch {
        // 从未成功打开时 destroy 会抛
      }
      book = null
      rendition = null
    },
  }
}

/** 把 epub.js 的嵌套目录拍平，并标出每一项落在 spine 的哪一节 */
function flattenToc(
  nodes: TocNode[],
  getSection: SpineLike['get'],
): IndexedTocEntry[] {
  const flat: Array<{ title: string; href: string }> = []
  const walk = (list: TocNode[]): void => {
    for (const node of list) {
      if (node.href) flat.push({ title: (node.label ?? '').trim(), href: node.href })
      if (node.subitems?.length) walk(node.subitems)
    }
  }
  walk(nodes)

  return flat.map((e) => ({
    title: e.title,
    spineIndex: getSection(e.href)?.index ?? -1,
  }))
}
