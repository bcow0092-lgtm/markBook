import { create } from 'zustand'
import type { Book } from '@shared/types'
import { sortByRecentRead } from '../lib/sortBooks'

export type AppView = 'shelf' | 'reader'

interface LibraryState {
  books: Book[]
  loading: boolean
  error: string | null
  /** 阅读视图在 M3 实现，字段先占好位 */
  view: AppView
  currentBookId: string | null
  refresh(): Promise<void>
  openBook(id: string): void
  backToShelf(): void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  books: [],
  loading: false,
  error: null,
  view: 'shelf',
  currentBookId: null,

  async refresh() {
    set({ loading: true, error: null })
    try {
      // 排序放在渲染进程而不是仓储：§3.2 说「默认按最近阅读」，M5 可能加
      // 别的排序方式，仓储的 listBooks 应当保持「全部书籍」这个朴素语义
      set({ books: sortByRecentRead(await window.api.listBooks()), loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  openBook(id) {
    set({ view: 'reader', currentBookId: id })
  },

  backToShelf() {
    set({ view: 'shelf', currentBookId: null })
  },
}))
