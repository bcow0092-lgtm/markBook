import { create } from 'zustand'
import { DEFAULT_READER_SETTINGS, type MarkReaderApi, type ReaderSettings } from '@shared/types'

interface SettingsState {
  settings: ReaderSettings
  loaded: boolean
  load(): Promise<void>
  set(next: ReaderSettings): void
}

/**
 * 阅读设置。**全局共享**，不是每本书独立（§4.2 的数据模型里
 * `ReaderSettings` 挂在 `LibraryData` 顶层）。
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  settings: { ...DEFAULT_READER_SETTINGS },
  loaded: false,

  async load() {
    try {
      set({ settings: await window.api.getSettings(), loaded: true })
    } catch {
      // 读不到就用默认值，不让设置读取失败挡住阅读
      set({ loaded: true })
    }
  },

  set(next) {
    set({ settings: next })
  },
}))

export interface SettingsSaver {
  push(settings: ReaderSettings): void
  flush(): Promise<void>
}

const DEFAULT_DEBOUNCE_MS = 300

/**
 * 设置的防抖落盘。
 *
 * 300ms 而不是进度的 1s：步进控件会连着点几下，每次都要立刻看到效果，
 * 但没必要每次都写盘。与进度同理，退出时要 flush。
 */
export function createSettingsSaver(
  api: MarkReaderApi,
  opts: { debounceMs?: number } = {},
): SettingsSaver {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS
  let pending: ReaderSettings | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  async function write(): Promise<void> {
    const toWrite = pending
    pending = null
    if (!toWrite) return
    // 写盘失败不该打断阅读，下一次改动会再试
    await api.saveSettings(toWrite).catch(() => {})
  }

  return {
    push(settings) {
      pending = settings
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void write()
      }, debounceMs)
    },

    async flush() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      await write()
    },
  }
}
