import ePub from 'epubjs'
import { withTimeout } from './withTimeout'

export interface BookMeta {
  title: string
  author: string
  coverBase64?: string
  coverExt?: string
}

/** 解析超时。损坏的 OPF 会让 epub.js 永不 settle（技术方案 §7.1）。 */
export const DEFAULT_META_TIMEOUT_MS = 15_000

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取封面失败'))
    reader.readAsDataURL(blob)
  })
}

/**
 * 用 epub.js 打开 staging 里的书，取出书名、作者与封面。
 *
 * 只做元数据提取、不渲染，因此不需要 rendition —— 也就绕开了「损坏的 OPF
 * 会让 display() 挂起」那个坑。但 book.loaded.metadata 在解析畸形文件时
 * 同样可能不 settle，所以仍然要加超时。
 */
export async function extractEpubMeta(
  bookUrl: string,
  timeoutMs = DEFAULT_META_TIMEOUT_MS,
): Promise<BookMeta> {
  const book = ePub(bookUrl)
  try {
    const failed = new Promise<never>((_, reject) => {
      book.on('openFailed', (err: unknown) => reject(new Error(`打开失败：${String(err)}`)))
    })

    const meta = await withTimeout(
      Promise.race([book.loaded.metadata, failed]),
      timeoutMs,
      '解析元数据',
    )

    let coverBase64: string | undefined
    let coverExt: string | undefined
    try {
      // epub.js 打开无封面书时会在内部抛未处理的拒绝（见 §8 风险清单），
      // 与下面这个调用无关 —— 这里挂一个空 catch，只是防止本 promise 晚于
      // race 结算后变成第二个未处理拒绝。
      const coverPromise = book.coverUrl()
      coverPromise.catch(() => {})

      const coverUrl = await withTimeout(Promise.race([coverPromise, failed]), timeoutMs, '提取封面')
      if (coverUrl) {
        const blob = await fetch(coverUrl).then((r) => r.blob())
        coverBase64 = await blobToBase64(blob)
        coverExt = EXT_BY_MIME[blob.type] ?? 'png'
      }
    } catch {
      // 没有封面、或封面提取失败，都不该让整次导入失败
    }

    return {
      title: (meta.title ?? '').trim(),
      author: (meta.creator ?? '').trim(),
      coverBase64,
      coverExt,
    }
  } finally {
    try {
      book.destroy()
    } catch {
      /* 已销毁或从未成功创建 */
    }
  }
}
