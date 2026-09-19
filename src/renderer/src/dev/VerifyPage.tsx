import { useEffect } from 'react'
import ePub from 'epubjs'

const PAGE_W = 600
const PAGE_H = 400
const GAP = 40

const CSS = `
.verify-viewport { width: ${PAGE_W}px; height: ${PAGE_H}px; overflow: hidden; border: 1px solid #ccc; }
.verify-columns {
  width: ${PAGE_W}px;
  height: ${PAGE_H}px;
  column-width: ${PAGE_W}px;
  column-gap: ${GAP}px;
  column-fill: auto;
  font-size: 16px;
  line-height: 1.8;
}
.verify-book { width: ${PAGE_W}px; height: ${PAGE_H}px; border: 1px solid #ccc; overflow: hidden; margin-top: 8px; }
`

const LONG_TEXT = '这是一段用于测试多列分页的中文文本，需要足够长才能溢出到第二列。'.repeat(200)

const BOOKS: Array<[string, string]> = [
  ['sample.epub', '普通书'],
  ['wide-table.epub', '超宽表格'],
  ['many-images.epub', '大图'],
  ['mixed-cjk-latin.epub', '中英混排'],
  ['no-cover-no-author.epub', '缺元数据'],
  ['broken-opf.epub', '损坏 OPF'],
]

function log(tag: string, payload: unknown): void {
  console.log(`[VERIFY:${tag}] ${JSON.stringify(payload)}`)
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} 超时 ${ms}ms`)), ms)),
  ])
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * epubjs 0.3.93 的 d.ts 不完整：Spine 上的 spineItems / length 运行时存在
 * 但没有类型声明。这里做一次局部断言，不影响运行。
 */
type SpineLike = { length: number; spineItems: Array<{ href: string }> }
const asSpine = (s: unknown): SpineLike => s as SpineLike

/** 验证 1：CSS 多列布局能否把纵向溢出的内容排到右边的列 */
function checkTxtPagination(): void {
  const viewport = document.querySelector<HTMLElement>('.verify-viewport')
  const columns = document.querySelector<HTMLElement>('.verify-columns')
  const marker = document.querySelector<HTMLElement>('.verify-end')
  if (!viewport || !columns || !marker) {
    log('txt-pagination', { ok: false, reason: 'DOM 未就绪' })
    return
  }

  const vp = viewport.getBoundingClientRect()
  const before = marker.getBoundingClientRect().left - vp.left
  columns.style.transform = `translateX(-${PAGE_W + GAP}px)`
  const after = marker.getBoundingClientRect().left - vp.left
  columns.style.transform = ''

  log('txt-pagination', {
    ok: before > PAGE_W && Math.round(before - after) === PAGE_W + GAP,
    columnsScrollWidth: columns.scrollWidth,
    viewportWidth: Math.round(vp.width),
    endMarkerX: Math.round(before),
    pagesRendered: Math.max(1, Math.ceil((before + 30) / (PAGE_W + GAP))),
    // 平移量必须正好是一页宽 + 一个列间距，否则翻页会错位
    shiftDelta: Math.round(before - after),
    expectedShift: PAGE_W + GAP,
  })
}

/**
 * 验证 2：epub.js 能否在 §2.2 的 CSP 下渲染。
 *
 * 注意第一页通常是封面页，body 里只有一个 <img>，文本很短 —— 必须先翻过
 * 几页再测量，否则会把「渲染正常」误判成「内容为空」。
 */
async function checkBook(file: string, label: string, deep = false): Promise<void> {
  const el = document.createElement('div')
  el.className = 'verify-book'
  document.querySelector('.verify-books')?.appendChild(el)

  const book = ePub(`app://local/books/${file}`)
  let openFailed: string | null = null
  book.on('openFailed', (e: unknown) => {
    openFailed = String(e)
  })

  try {
    const rendition = book.renderTo(el, {
      flow: 'paginated',
      spread: 'none',
      width: '100%',
      height: '100%',
    })
    await withTimeout(rendition.display(), 20000, 'display')

    const metadata = await withTimeout(book.loaded.metadata, 10000, 'metadata')
    const navigation = await withTimeout(book.loaded.navigation, 10000, 'navigation')
    const coverUrl = await withTimeout(book.coverUrl(), 10000, 'coverUrl')

    // 翻过封面页，取各页里最大的正文长度与最大的表格规模
    let maxText = 0
    let maxTd = 0
    let maxTableWidth = -1
    let tablePages = 0
    let pagesTurned = 0

    const sample = (): void => {
      const doc = el.querySelector('iframe')?.contentDocument ?? null
      if (!doc?.body) return
      maxText = Math.max(maxText, doc.body.textContent?.length ?? 0)
      for (const t of Array.from(doc.querySelectorAll('table'))) {
        const td = t.querySelectorAll('td,th').length
        if (td > maxTd) {
          maxTd = td
          maxTableWidth = Math.round(t.getBoundingClientRect().width)
        }
      }
      if (doc.querySelectorAll('table').length > 0) tablePages++
    }

    for (let i = 0; i < 8; i++) {
      await sleep(250)
      sample()
      await rendition.next().catch(() => {})
      pagesTurned++
    }

    // 深扫：逐章打开并记录每章的表格规模。只翻页碰不到注入点 —— 书有 16 章，
    // 注入在第二章；另外源书第一章自带 2 张表，会干扰聚合值的归因。
    if (deep && book.spine) {
      for (const item of asSpine(book.spine).spineItems ?? []) {
        await rendition.display(item.href).catch(() => {})
        await sleep(300)
        const doc = el.querySelector('iframe')?.contentDocument ?? null
        const rows = Array.from(doc?.querySelectorAll('table') ?? []).map((t) => ({
          cells: t.querySelectorAll('td,th').length,
          width: Math.round(t.getBoundingClientRect().width),
        }))
        if (rows.length > 0) {
          log('epub-tables', {
            href: String(item.href).split('/').pop(),
            columns: doc?.querySelector('table')?.querySelectorAll('tr')[0]?.children.length ?? -1,
            tables: rows,
          })
        }
        sample()
      }
    }

    log('epub', {
      label,
      // 判据是「拿到了元数据 + 至少有一页有正文」，不是第一页的长度
      ok: maxText > 200 && Boolean(metadata.title),
      openFailed,
      title: metadata.title ?? null,
      creator: metadata.creator ?? null,
      spineLength: book.spine ? asSpine(book.spine).length : -1,
      tocEntries: navigation?.toc?.length ?? 0,
      hasCover: Boolean(coverUrl),
      maxTextLength: maxText,
      pagesTurned,
      maxTdCount: maxTd,
      maxTableWidth,
      tablePages,
      containerWidth: Math.round(el.getBoundingClientRect().width),
      tableOverflowsPage: maxTableWidth > el.getBoundingClientRect().width,
    })
  } catch (err) {
    log('epub', { label, ok: false, openFailed, error: String(err) })
  } finally {
    try {
      book.destroy()
    } catch {
      /* 忽略 */
    }
  }
}

/** 验证 3：app:// 是否支持 Range 请求 */
async function checkRange(): Promise<void> {
  try {
    const res = await fetch('app://local/books/sample.epub', { headers: { Range: 'bytes=0-99' } })
    const buf = await res.arrayBuffer()
    const full = await fetch('app://local/books/sample.epub')
    const fullBuf = await full.arrayBuffer()
    log('range', {
      ok: res.status === 206 && buf.byteLength === 100,
      status: res.status,
      bytes: buf.byteLength,
      fullBytes: fullBuf.byteLength,
      contentRange: res.headers.get('content-range'),
    })
  } catch (err) {
    log('range', { ok: false, error: String(err) })
  }
}

export default function VerifyPage() {
  useEffect(() => {
    void (async () => {
      await sleep(100)
      checkTxtPagination()
      await checkRange()
      for (const [file, label] of BOOKS) {
        // 只有超宽表格那本需要逐章深扫，其余翻几页就够
        await checkBook(file, label, file === 'wide-table.epub')
      }
      log('done', { finished: true })
    })()
  }, [])

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <style>{CSS}</style>
      <h3>M1 风险验证</h3>

      <p>1. TXT 多列分页</p>
      <div className="verify-viewport">
        <div className="verify-columns">
          {LONG_TEXT}
          <span className="verify-end">END</span>
        </div>
      </div>

      <p style={{ marginTop: 16 }}>2. epub.js 渲染</p>
      <div className="verify-books" />
    </div>
  )
}
