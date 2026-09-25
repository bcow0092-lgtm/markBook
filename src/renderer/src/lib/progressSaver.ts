import type { MarkReaderApi, ReadingProgress } from '@shared/types'

export interface ProgressSaver {
  /** 记录最新进度并安排落盘。刻意不返回 promise —— relocated 是高频事件 */
  push(progress: ReadingProgress): void
  /** 立即落盘。退出阅读页、窗口关闭时调 */
  flush(): Promise<void>
  /** 丢弃未落盘的改动，换书或卸载时用 */
  dispose(): void
}

const DEFAULT_DEBOUNCE_MS = 1000

/**
 * 进度的防抖落盘（技术方案 §5.5）。
 *
 * 1 秒防抖。**只靠防抖会丢数据**：用户翻完最后一页立刻关窗，这次进度就没了。
 * 所以调用方必须在退出阅读页与窗口关闭时调 flush —— 这也正是本模块存在的
 * 意义，否则直接调 api.saveProgress 就够了。
 */
export function createProgressSaver(
  api: MarkReaderApi,
  bookId: string,
  opts: { debounceMs?: number } = {},
): ProgressSaver {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS
  let pending: ReadingProgress | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  function clearTimer(): void {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  async function write(): Promise<void> {
    const toWrite = pending
    pending = null
    if (!toWrite || disposed) return
    // 落盘失败不该打断阅读。下一次 relocated 会再试
    await api.saveProgress(bookId, toWrite).catch(() => {})
  }

  return {
    push(progress) {
      if (disposed) return
      pending = progress
      clearTimer()
      timer = setTimeout(() => {
        timer = null
        void write()
      }, debounceMs)
    },

    async flush() {
      clearTimer()
      await write()
    },

    dispose() {
      disposed = true
      clearTimer()
      pending = null
    },
  }
}
