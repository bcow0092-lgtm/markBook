import { vi } from 'vitest'
import type { Book, MarkReaderApi, ReaderSettings } from '@shared/types'

/**
 * MarkReaderApi 的测试替身。
 *
 * 抽出来是因为接口每加一个方法，散落各处的 mock 就要各补一次 —— M3 加
 * locations 两个方法时已经第二次踩到。集中在这儿，以后只改一个地方。
 */
export function makeApi(overrides: Partial<MarkReaderApi> = {}): MarkReaderApi {
  const api: MarkReaderApi = {
    listBooks: vi.fn(async () => [] as Book[]),
    importBook: vi.fn(async () => null),
    commitImport: vi.fn(async () => ({}) as Book),
    abortImport: vi.fn(async () => {}),
    deleteBook: vi.fn(async () => {}),
    getLocations: vi.fn(async () => null),
    saveLocations: vi.fn(async () => {}),
    saveProgress: vi.fn(async () => {}),
    getSettings: vi.fn(
      async (): Promise<ReaderSettings> => ({
        fontSize: 18,
        lineHeight: 1.8,
        pageMargin: 'medium',
      }),
    ),
    saveSettings: vi.fn(async () => {}),
  }
  return { ...api, ...overrides }
}
