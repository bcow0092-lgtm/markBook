import ePub from 'epubjs'
import type { ReaderSettings, ReadingProgress } from '@shared/types'
import { PAGE_MARGIN_PX } from '../../lib/readerSettings'
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
type RelocatedStart = { cfi?: string; index?: number; percentage?: number }
type RelocatedLike = { start?: RelocatedStart }

export function createEpubEngine(opts: EngineOptions): ReaderEngine {
  // EngineOptions 里这两个是给 TXT 省掉的，EPUB 一定要用，这里收成必有
  const loadLocations = opts.loadLocations ?? (async () => null)
  const saveLocations = opts.saveLocations ?? (async () => {})

  let book: ReturnType<typeof ePub> | null = null
  let rendition: ReturnType<ReturnType<typeof ePub>['renderTo']> | null = null
  let toc: IndexedTocEntry[] = []
  let spineLength = 0
  let indexReady = false
  let destroyed = false

  const spineOf = (b: ReturnType<typeof ePub>): SpineLike => b.spine as unknown as SpineLike
  const locationsOf = (b: ReturnType<typeof ePub>): LocationsLike =>
    b.locations as unknown as LocationsLike

  /**
   * 用 relocated 事件给的 start 组装进度。
   *
   * 百分比**不用** `locations.percentageFromCfi(cfi)` —— 那是 §5.2 原本写的
   * 做法，实测会给出离谱的值（第一页算出 50%）。原因是 epub.js 的
   * `locationFromCfi` 拿 CFI 做**字符串比较**，而 relocated 给的是点 CFI、
   * 索引里存的是带逗号的区间 CFI，比较结果会跑偏。
   *
   * relocated 载荷里的 `start.percentage` 是 epub.js 自己算好的，实测正确，
   * 直接用它。
   */
  function progressFromLocation(start: RelocatedStart): ReadingProgress {
    const spineIndex = start.index ?? 0
    const chapter = findCurrentChapter(toc, spineIndex)
    const percentage = indexReady
      ? clamp01(start.percentage ?? 0)
      : estimatePercentage(spineIndex, spineLength)
    return {
      location: start.cfi ?? '',
      percentage,
      percentageExact: indexReady,
      chapterIndex: chapter.tocIndex,
      chapterTitle: chapter.title,
    }
  }

  /** 索引生成完成后用它重发一次进度，让 UI 从 ~35% 收敛到 35% */
  function reemitWithExactPercentage(): void {
    if (!rendition || destroyed) return
    try {
      const loc = rendition.currentLocation() as RelocatedLike | undefined
      if (!loc?.start?.cfi) return
      opts.callbacks.onRelocated(progressFromLocation(loc.start))
    } catch {
      // StrictMode 下引擎可能已被销毁但异步回调仍在跑，此时 epub.js 的
      // 内部对象已经拆掉，调它会抛。忽略即可 —— 这个引擎已经没用了
    }
  }

  async function setupLocations(): Promise<void> {
    const b = book
    if (!b) return
    const saved = await loadLocations().catch(() => null)
    // await 之后必须重查 —— StrictMode 双挂载时，这个引擎可能已经被销毁了
    if (destroyed || book !== b) return

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
        if (destroyed || book !== b) return
        indexReady = true
        reemitWithExactPercentage()
        await saveLocations(locationsOf(b).save()).catch(() => {})
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
      // 同一个章节被重复渲染时不要重复包裹
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

      // 等 attach 完成再往下走（见 waitAttached 的说明）
      await waitAttached(rendition)
      if (destroyed || book !== b) return

      ;(rendition.hooks.content as unknown as { register(fn: unknown): void }).register(
        handleContent,
      )

      // 必须等书加载完再读 spine —— 在 renderTo 之后立刻读会拿到 0。
      // spineLength 为 0 时 seekTarget 会退化成「跳到第一章」，表现为拖进度
      // 条总是回到封面；estimatePercentage 也会恒为 0。
      await b.ready
      if (destroyed || book !== b) return
      spineLength = spineOf(b).length ?? 0

      rendition.on('relocated', (loc: unknown) => {
        // StrictMode 双挂载下，被销毁的那个引擎仍可能收到事件
        if (destroyed) return
        const start = (loc as RelocatedLike).start
        if (!start?.cfi) return
        opts.callbacks.onRelocated(progressFromLocation(start))
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
      if (!entry || entry.index < 0 || !book) return
      // 用 spine 里的 href 而不是目录项原始的 — 后者常带锚点
      const section = spineOf(book).get(entry.index)
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

    applySettings(settings: ReaderSettings) {
      if (!book || !rendition || destroyed) return

      // 先记住现在读到哪了。改样式会让文本重排，不记就跳页（§5.2 的坑 2）
      const loc = rendition.currentLocation() as RelocatedLike | undefined
      const cfi = loc?.start?.cfi

      const themes = rendition.themes as unknown as {
        fontSize(px: string): void
        override(name: string, value: string): void
      }
      themes.fontSize(`${settings.fontSize}px`)
      themes.override('line-height', String(settings.lineHeight))
      const px = PAGE_MARGIN_PX[settings.pageMargin]
      themes.override('padding-left', `${px}px`)
      themes.override('padding-right', `${px}px`)

      rendition.resize(opts.container.clientWidth, opts.container.clientHeight)

      // 回到同一处。布局变了，用原 cfi 重新定位即可 —— epub.js 会把它映射到
      // 新布局下最接近的位置
      if (cfi) display(cfi)
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

/**
 * 等 rendition 完成 attach。
 *
 * epub.js 的 `renderTo()` 立刻返回 Rendition，但内部的 `manager` 是稍后由
 * `Rendition.start()` 才创建的。`display()` / `prev()` / `next()` 走 rendition
 * 自己的队列，会排在 manager 就绪之后，所以没事；而 `currentLocation()` /
 * `resize()` / `themes.*` **直接访问 `this.manager`、不排队**，早调就抛
 * 「Cannot read properties of undefined (reading 'currentLocation')」。
 *
 * **这是个只在特定时序下暴露的竞态。** 开发模式下 `load()` 里的几次 await
 * （`book.ready`、`loaded.navigation`）恰好给了队列足够时间，所以从 M3 到
 * M5 一直没踩到；生产模式下时序不同，一开书就炸。
 */
function waitAttached(rendition: unknown, timeoutMs = 10_000): Promise<void> {
  const r = rendition as {
    manager?: unknown
    on(event: string, cb: () => void): void
  }
  // 已经 attach 过就直接返回 —— 只挂监听的话会永远等下去
  if (r.manager) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('阅读器初始化超时')), timeoutMs)
    r.on('attached', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
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
    index: getSection(e.href)?.index ?? -1,
  }))
}
