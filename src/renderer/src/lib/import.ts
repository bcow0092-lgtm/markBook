import type { Book, MarkReaderApi } from '@shared/types'
import { extractEpubMeta } from './epubMeta'

/**
 * 去掉扩展名作为书名兜底。
 *
 * TXT 没有 epub.js 那样的元数据解析，书名只能从文件名推导，走的是这条。
 * 主进程的 `services/library.ts` 里有一份规则相同的实现，用作 commit 收到
 * 空书名时的兜底 —— **两处必须一起改**。
 *
 * 只有扩展名的文件名（如 `.txt`）按 Node 的语义视为没有扩展名，原样返回。
 */
export function titleFromFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, '')
  const dot = base.lastIndexOf('.')
  return (dot > 0 ? base.slice(0, dot) : base).trim() || '未命名'
}

/**
 * 一次完整的导入：调主进程 staging → 解析元数据 → 提交；任一步失败都回滚。
 *
 * `api` 作为参数传入而不是直接用 `window.api`，这条流程才能在单测里注入
 * 假实现。真实调用方传 `window.api` 即可。
 */
export async function importBookFlow(
  api: MarkReaderApi,
  timeoutMs?: number,
): Promise<Book | null> {
  const staged = await api.importBook()
  if (!staged) return null // 用户取消

  try {
    const meta =
      staged.format === 'epub'
        ? await extractEpubMeta(`app://local/books/.staging/${staged.id}.epub`, timeoutMs)
        : { title: titleFromFileName(staged.originalName), author: '' }

    return await api.commitImport(staged.id, {
      title: meta.title,
      author: meta.author,
      coverBase64: meta.coverBase64,
      coverExt: meta.coverExt,
    })
  } catch (err) {
    // 回滚。这一步即便也失败也不能盖掉原始错误 —— 原始错误才是可诊断的
    // 那个。残留的 staging 文件由下次启动的 clearStaging 兜底（§5.6）。
    await api.abortImport(staged.id).catch(() => {})
    throw err
  }
}
