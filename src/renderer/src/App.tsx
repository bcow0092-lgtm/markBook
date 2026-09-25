import { useLibraryStore } from './store/library'
import { useReaderStore } from './store/reader'
import { ShelfPage } from './pages/Shelf/ShelfPage'
import { ReaderPage } from './pages/Reader/ReaderPage'

export default function App() {
  const view = useLibraryStore((s) => s.view)
  const books = useLibraryStore((s) => s.books)
  const currentBookId = useLibraryStore((s) => s.currentBookId)
  const backToShelf = useLibraryStore((s) => s.backToShelf)
  const setReaderProgress = useReaderStore((s) => s.setProgress)

  const current = books.find((b) => b.id === currentBookId)
  if (view === 'reader' && current) {
    return (
      <ReaderPage
        book={current}
        onBack={backToShelf}
        // M3 的这个任务只把进度收进 store 供 UI 显示；
        // 落盘（防抖 + 退出时 flush）在 Task 6 接进 ReaderPage
        onProgress={setReaderProgress}
      />
    )
  }
  return <ShelfPage />
}
