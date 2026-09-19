import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importBookFlow, titleFromFileName } from '../../src/renderer/src/lib/import'
import { extractEpubMeta } from '../../src/renderer/src/lib/epubMeta'
import type { Book, CommitPayload, ImportResult, MarkReaderApi } from '@shared/types'

/**
 * 把 epub.js 那层打桩。这个文件测的是**编排**（取消、TXT 路径、失败回滚），
 * 不是 epub.js 的行为 —— 真把 epub.js 拉进来会让本文件在 jsdom 环境下多跑
 * 40 秒，而那部分由 Task 7 的人工验证与 M3 的 E2E 覆盖。
 */
vi.mock('../../src/renderer/src/lib/epubMeta', () => ({
  extractEpubMeta: vi.fn(async () => ({ title: '解析出的书名', author: '解析出的作者' })),
  DEFAULT_META_TIMEOUT_MS: 15_000,
}))

const mockExtract = vi.mocked(extractEpubMeta)

beforeEach(() => {
  mockExtract.mockReset()
  mockExtract.mockResolvedValue({ title: '解析出的书名', author: '解析出的作者' })
})

const TXT_RESULT: ImportResult = {
  id: 'id1',
  format: 'txt',
  originalName: '吾辈是猫.txt',
  sourceEncoding: 'GB18030',
}

function makeApi(overrides: Partial<MarkReaderApi> = {}): MarkReaderApi {
  return {
    listBooks: vi.fn(async () => []),
    importBook: vi.fn(async () => TXT_RESULT),
    commitImport: vi.fn(
      async (_id: string, payload: CommitPayload) => ({ ...payload, id: 'id1' }) as unknown as Book,
    ),
    abortImport: vi.fn(async () => {}),
    deleteBook: vi.fn(async () => {}),
    saveProgress: vi.fn(async () => {}),
    getSettings: vi.fn(async () => ({
      fontSize: 18,
      lineHeight: 1.8,
      pageMargin: 'medium' as const,
    })),
    saveSettings: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('titleFromFileName（渲染进程侧）', () => {
  it('与主进程同一规则：去路径、去扩展名', () => {
    expect(titleFromFileName('吾辈是猫.txt')).toBe('吾辈是猫')
    expect(titleFromFileName('C:\\books\\吾辈是猫.epub')).toBe('吾辈是猫')
    expect(titleFromFileName('C:/books/吾辈是猫.epub')).toBe('吾辈是猫')
  })

  it('空名字回落到「未命名」', () => {
    expect(titleFromFileName('')).toBe('未命名')
    expect(titleFromFileName('   ')).toBe('未命名')
  })

  it('与主进程同规则：只有扩展名时原样返回', () => {
    expect(titleFromFileName('.txt')).toBe('.txt')
  })
})

describe('importBookFlow', () => {
  it('用户取消时返回 null，既不提交也不回滚', async () => {
    const api = makeApi({ importBook: vi.fn(async () => null) })
    expect(await importBookFlow(api)).toBeNull()
    expect(api.commitImport).not.toHaveBeenCalled()
    expect(api.abortImport).not.toHaveBeenCalled()
  })

  it('TXT 用文件名作书名（去掉扩展名）', async () => {
    const api = makeApi()
    await importBookFlow(api)
    expect(api.commitImport).toHaveBeenCalledWith(
      'id1',
      expect.objectContaining({ title: '吾辈是猫' }),
    )
  })

  it('TXT 的作者为空串，且不带封面字段', async () => {
    const api = makeApi()
    await importBookFlow(api)
    const payload = (api.commitImport as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(payload.author).toBe('')
    expect(payload.coverBase64).toBeUndefined()
  })

  it('返回提交后的 Book', async () => {
    const api = makeApi()
    const book = await importBookFlow(api)
    expect(book).not.toBeNull()
    expect(book!.id).toBe('id1')
  })

  it('EPUB 走元数据解析，并把封面一并提交', async () => {
    mockExtract.mockResolvedValue({
      title: '解析出的书名',
      author: '解析出的作者',
      coverBase64: 'QUJD',
      coverExt: 'png',
    })
    const api = makeApi({
      importBook: vi.fn(async () => ({
        id: 'id1',
        format: 'epub' as const,
        originalName: 'x.epub',
        sourceEncoding: null,
      })),
    })

    await importBookFlow(api)

    // 解析的是 staging 里的那个文件，而不是将来 books/ 下的正式路径
    expect(mockExtract).toHaveBeenCalledWith('app://local/books/.staging/id1.epub', undefined)
    expect(api.commitImport).toHaveBeenCalledWith(
      'id1',
      expect.objectContaining({
        title: '解析出的书名',
        author: '解析出的作者',
        coverBase64: 'QUJD',
        coverExt: 'png',
      }),
    )
  })

  it('EPUB 解析失败时回滚并抛出', async () => {
    mockExtract.mockRejectedValue(new Error('解析元数据超时（500ms）'))
    const api = makeApi({
      importBook: vi.fn(async () => ({
        id: 'id1',
        format: 'epub' as const,
        originalName: 'x.epub',
        sourceEncoding: null,
      })),
    })

    await expect(importBookFlow(api, 500)).rejects.toThrow('解析元数据超时')
    expect(api.abortImport).toHaveBeenCalledWith('id1')
    expect(api.commitImport).not.toHaveBeenCalled()
  })

  it('提交本身失败时同样回滚', async () => {
    const api = makeApi({
      commitImport: vi.fn(async () => {
        throw new Error('磁盘满了')
      }),
    })

    await expect(importBookFlow(api)).rejects.toThrow('磁盘满了')
    expect(api.abortImport).toHaveBeenCalledWith('id1')
  })

  it('即便回滚也失败，仍抛出原始错误', async () => {
    const api = makeApi({
      commitImport: vi.fn(async () => {
        throw new Error('原始错误')
      }),
      abortImport: vi.fn(async () => {
        throw new Error('回滚也挂了')
      }),
    })

    await expect(importBookFlow(api)).rejects.toThrow('原始错误')
  })
})
