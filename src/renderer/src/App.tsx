import { useLibraryStore } from './store/library'
import { useReaderStore } from './store/reader'
import { ShelfPage } from './pages/Shelf/ShelfPage'
import { ReaderPage } from './pages/Reader/ReaderPage'

export default function App() {
  const view = useLibraryStore((s) => s.view)
  const books = useLibraryStore((s) => s.books)
  const currentBookId = useLibraryStore((s) => s.currentBookId)
  const backToShelf = useLibraryStore((s) => s.backToShelf)
  const refresh = useLibraryStore((s) => s.refresh)
  const setReaderProgress = useReaderStore((s) => s.setProgress)

  const current = books.find((b) => b.id === currentBookId)
  if (view === 'reader' && current) {
    return (
      <ReaderPage
        book={current}
        onBack={() => {
          backToShelf()
          // 读过的书要按最近阅读排到前面（§3.2），进度角标也要更新。
          // ReaderPage 内部已经先 flush 过进度，这里刷新读到的是新值。
          void refresh()
        }}
        onProgress={setReaderProgress}
      />
    )
  }
  return <ShelfPage />
}
