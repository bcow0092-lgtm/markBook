import { useEffect, useState } from 'react'
import { useLibraryStore } from '../../store/library'
import { importBookFlow } from '../../lib/import'
import { BookCard } from './BookCard'

export function ShelfPage() {
  const books = useLibraryStore((s) => s.books)
  const loading = useLibraryStore((s) => s.loading)
  const error = useLibraryStore((s) => s.error)
  const refresh = useLibraryStore((s) => s.refresh)
  const openBook = useLibraryStore((s) => s.openBook)

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleImport = async (): Promise<void> => {
    setImporting(true)
    setImportError(null)
    try {
      const book = await importBookFlow(window.api)
      if (book) await refresh()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    try {
      // 确认对话框在主进程弹（§2.1），这里只管调用与刷新
      await window.api.deleteBook(id)
      await refresh()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }

  const message = importError ?? error

  return (
    <div className="min-h-screen bg-[var(--color-shelf-bg)] p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-medium text-[var(--color-reader-text)]">书架</h1>
        <button
          type="button"
          onClick={handleImport}
          disabled={importing}
          className="cursor-pointer rounded bg-[var(--color-reader-accent)] px-3 py-1.5 text-sm text-white disabled:cursor-default disabled:opacity-50"
        >
          {importing ? '导入中…' : '导入'}
        </button>
      </header>

      {message && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>
      )}

      {loading && books.length === 0 ? (
        <p className="py-24 text-center text-sm text-[var(--color-reader-muted)]">加载中…</p>
      ) : books.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-sm text-[var(--color-reader-muted)]">
            还没有书，导入一本 EPUB 或 TXT 开始阅读。
          </p>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="mt-4 cursor-pointer rounded bg-[var(--color-reader-accent)] px-4 py-2 text-sm text-white disabled:cursor-default disabled:opacity-50"
          >
            {importing ? '导入中…' : '导入第一本书'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-5">
          {books.map((b) => (
            <BookCard key={b.id} book={b} onOpen={openBook} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
