import { useEffect, useRef, useState } from 'react'
import type { Book, ReadingProgress } from '@shared/types'
import { createEpubEngine } from '../../components/reader/EpubEngine'
import type { ReaderEngine } from '../../components/reader/engine'
import type { IndexedTocEntry } from '../../lib/readerProgress'
import { ClickZones } from '../../components/reader/ClickZones'
import { ProgressBar } from '../../components/reader/ProgressBar'
import { TocPanel } from '../../components/reader/TocPanel'
import { ReaderToolbar } from '../../components/reader/ReaderToolbar'

interface Props {
  book: Book
  onBack(): void
  onProgress(progress: ReadingProgress): void
}

export function ReaderPage({ book, onBack, onProgress }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<ReaderEngine | null>(null)
  const [toc, setToc] = useState<IndexedTocEntry[]>([])
  const [chapterIndex, setChapterIndex] = useState(-1)
  const [chapterTitle, setChapterTitle] = useState('')
  const [percentage, setPercentage] = useState(0)
  const [exact, setExact] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [tocOpen, setTocOpen] = useState(false)

  // 回调走 ref，effect 的依赖只留 book.id。
  //
  // 依赖里放 book 对象或 onProgress 函数都会出事：前者在每次书架 refresh 后
  // 都是新引用，后者是 App 里的内联箭头函数、每次渲染都变 —— 两者都会让
  // 下面的 effect 反复执行，引擎被销毁重建，正文无限重排。
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress
  const bookRef = useRef(book)
  bookRef.current = book

  useEffect(() => {
    const container = containerRef.current
    const b = bookRef.current
    if (!container) return

    const engine = createEpubEngine({
      container,
      loadLocations: () => window.api.getLocations(b.id),
      saveLocations: (json) => window.api.saveLocations(b.id, json),
      callbacks: {
        onRelocated(p) {
          setPercentage(p.percentage)
          setExact(p.percentageExact)
          setChapterIndex(p.chapterIndex)
          setChapterTitle(p.chapterTitle)
          onProgressRef.current(p)
        },
        onToc: setToc,
      },
    })
    engineRef.current = engine

    engine.load(b, b.progress?.location ?? null).catch((err) => {
      console.error('[reader] 打开失败', err)
    })

    const onResize = (): void => engine.resize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      engine.destroy()
      engineRef.current = null
    }
  }, [book.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const engine = engineRef.current
      if (!engine) return
      if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        engine.prev()
      } else if (['ArrowRight', 'PageDown', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault()
        engine.next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--color-reader-bg)]">
      <div ref={containerRef} className="h-full w-full" />

      <ClickZones
        onPrev={() => engineRef.current?.prev()}
        onNext={() => engineRef.current?.next()}
        onToggleControls={() => setControlsVisible((v) => !v)}
      />

      <ReaderToolbar
        visible={controlsVisible}
        chapterTitle={chapterTitle}
        onBack={onBack}
        onOpenToc={() => setTocOpen(true)}
      />

      {controlsVisible && (
        <div className="absolute inset-x-0 bottom-0">
          <ProgressBar
            value={percentage}
            exact={exact}
            onPreview={setPercentage}
            onCommit={(p) => engineRef.current?.goToPercentage(p)}
          />
        </div>
      )}

      {tocOpen && (
        <TocPanel
          entries={toc}
          currentIndex={chapterIndex}
          onSelect={(i) => {
            engineRef.current?.goToChapter(i)
            setTocOpen(false)
          }}
          onClose={() => setTocOpen(false)}
        />
      )}
    </div>
  )
}
