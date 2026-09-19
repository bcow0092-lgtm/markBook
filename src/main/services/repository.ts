import { readFile, writeFile, rename } from 'node:fs/promises'
import {
  createEmptyLibrary,
  DEFAULT_READER_SETTINGS,
  type Book,
  type LibraryData,
  type ReaderSettings,
} from '@shared/types'

export interface Repository {
  load(): Promise<void>
  listBooks(): Book[]
  upsertBook(book: Book): Promise<void>
  removeBook(id: string): Promise<void>
  getSettings(): ReaderSettings
  saveSettings(settings: ReaderSettings): Promise<void>
  flush(): Promise<void>
}

export interface RepositoryOptions {
  debounceMs?: number
}

const DEFAULT_DEBOUNCE_MS = 500

function isValid(b: unknown): b is Book {
  if (typeof b !== 'object' || b === null) return false
  const o = b as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.title === 'string' && typeof o.fileName === 'string'
}

export function createRepository(
  libraryFile: string,
  options: RepositoryOptions = {},
): Repository {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  let data: LibraryData = createEmptyLibrary()
  let timer: NodeJS.Timeout | null = null
  let writing: Promise<void> | null = null

  async function writeNow(): Promise<void> {
    // 串行化：上一次写还没结束就不要交叠
    if (writing) await writing.catch(() => {})
    // 先写临时文件再 rename —— 避免在写入中途崩溃时留下半个 JSON
    writing = (async () => {
      const tmp = `${libraryFile}.tmp`
      await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
      await rename(tmp, libraryFile)
    })()
    try {
      await writing
    } finally {
      writing = null
    }
  }

  /**
   * 标记为脏并安排落盘。刻意不返回 promise —— 调用方（如高频触发的
   * relocated 事件）一旦等待写盘，每次调用都会把防抖窗口走满，防抖就
   * 退化成了节流。
   */
  function schedule(): void {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void writeNow()
    }, debounceMs)
  }

  return {
    async load(): Promise<void> {
      let raw: string
      try {
        raw = await readFile(libraryFile, 'utf8')
      } catch {
        data = createEmptyLibrary() // 首次运行
        return
      }

      try {
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed !== 'object' || parsed === null) throw new Error('不是对象')
        const o = parsed as Partial<LibraryData>
        if (!Array.isArray(o.books)) throw new Error('books 不是数组')
        data = {
          version: 1,
          books: o.books.filter(isValid),
          settings: { ...DEFAULT_READER_SETTINGS, ...(o.settings ?? {}) },
        }
      } catch {
        // 损坏文件留档而不是静默丢弃，便于事后排查
        await rename(libraryFile, `${libraryFile}.corrupt`).catch(() => {})
        data = createEmptyLibrary()
      }
    },

    listBooks: () => data.books,

    async upsertBook(book: Book): Promise<void> {
      const i = data.books.findIndex((b) => b.id === book.id)
      if (i >= 0) data.books[i] = book
      else data.books.push(book)
      schedule()
    },

    async removeBook(id: string): Promise<void> {
      data.books = data.books.filter((b) => b.id !== id)
      schedule()
    },

    getSettings: () => ({ ...data.settings }),

    async saveSettings(settings: ReaderSettings): Promise<void> {
      data.settings = { ...settings }
      schedule()
    },

    async flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer)
        timer = null
        await writeNow()
      } else if (writing) {
        await writing
      }
    },
  }
}
