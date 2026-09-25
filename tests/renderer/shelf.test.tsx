// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { ShelfPage } from '../../src/renderer/src/pages/Shelf/ShelfPage'
import { useLibraryStore } from '../../src/renderer/src/store/library'
import { makeApi } from './makeApi'
import type { Book, MarkReaderApi } from '@shared/types'

const book = (over: Partial<Book> = {}): Book => ({
  id: 'a',
  title: '书名一',
  author: '作者一',
  format: 'epub',
  fileName: 'a.epub',
  coverFileName: null,
  size: 1,
  addedAt: 1,
  lastReadAt: null,
  progress: null,
  sourceEncoding: null,
  locationsReady: true,
  ...over,
})

function installApi(books: Book[]): MarkReaderApi {
  const api = makeApi({ listBooks: vi.fn(async () => books) })
  window.api = api
  return api
}

beforeEach(() => {
  useLibraryStore.setState({ books: [], loading: false, error: null, view: 'shelf', currentBookId: null })
})

afterEach(cleanup)

describe('ShelfPage —— 空态', () => {
  it('没有书时显示引导文案与导入按钮', async () => {
    installApi([])
    render(<ShelfPage />)

    await waitFor(() => expect(screen.getByText(/还没有书/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /导入第一本书/ })).toBeInTheDocument()
  })
})

describe('ShelfPage —— 列表', () => {
  it('渲染书名与作者', async () => {
    installApi([book()])
    render(<ShelfPage />)

    expect(await screen.findByText('书名一')).toBeInTheDocument()
    expect(screen.getByText('作者一')).toBeInTheDocument()
  })

  it('作者缺失时显示「未知作者」', async () => {
    installApi([book({ author: '' })])
    render(<ShelfPage />)

    expect(await screen.findByText('未知作者')).toBeInTheDocument()
  })

  it('缺封面时用书名首字占位', async () => {
    installApi([book({ coverFileName: null, title: '吾辈是猫' })])
    render(<ShelfPage />)

    expect(await screen.findByText('吾')).toBeInTheDocument()
  })

  it('有封面时渲染图片，不留占位字', async () => {
    installApi([book({ coverFileName: 'a.png', title: '吾辈是猫' })])
    render(<ShelfPage />)

    // 封面是装饰性的（alt=""），无障碍树里没有 img 角色，用 testid 查
    const img = await screen.findByTestId('cover')
    expect(img).toHaveAttribute('src', 'app://local/covers/a.png')
  })
})

describe('ShelfPage —— 进度角标', () => {
  it('未读的书不显示角标', async () => {
    installApi([book({ progress: null })])
    render(<ShelfPage />)

    await screen.findByText('书名一')
    expect(screen.queryByTestId('progress-badge')).toBeNull()
  })

  it('已读的书显示整数百分比', async () => {
    installApi([
      book({
        progress: {
          location: 'cfi',
          percentage: 0.356,
          percentageExact: true,
          chapterIndex: 0,
          chapterTitle: '第一章',
        },
      }),
    ])
    render(<ShelfPage />)

    expect(await screen.findByTestId('progress-badge')).toHaveTextContent('36%')
  })

  it('估算值带 ~ 前缀', async () => {
    installApi([
      book({
        progress: {
          location: 1,
          percentage: 0.35,
          percentageExact: false,
          chapterIndex: 0,
          chapterTitle: '',
        },
      }),
    ])
    render(<ShelfPage />)

    expect(await screen.findByTestId('progress-badge')).toHaveTextContent('~35%')
  })
})

describe('ShelfPage —— 错误态', () => {
  it('加载失败时显示错误信息', async () => {
    const api = installApi([])
    api.listBooks = vi.fn(async () => {
      throw new Error('读取书架失败')
    })
    window.api = api

    render(<ShelfPage />)

    expect(await screen.findByText(/读取书架失败/)).toBeInTheDocument()
  })
})
