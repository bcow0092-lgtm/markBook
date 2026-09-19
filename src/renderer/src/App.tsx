import { ShelfPage } from './pages/Shelf/ShelfPage'

export default function App() {
  // 阅读视图在 M3 实现。store 里已经有 view / currentBookId 两个字段，
  // M3 把它们接上即可，现在只有书架一个视图。
  return <ShelfPage />
}
