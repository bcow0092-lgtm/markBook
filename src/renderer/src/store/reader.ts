import { create } from 'zustand'
import type { ReadingProgress } from '@shared/types'

interface ReaderState {
  /** 当前阅读位置。书架刷新前先收在这里，供 UI 即时反映 */
  progress: ReadingProgress | null
  setProgress(progress: ReadingProgress): void
  clear(): void
}

export const useReaderStore = create<ReaderState>((set) => ({
  progress: null,
  setProgress: (progress) => set({ progress }),
  clear: () => set({ progress: null }),
}))
