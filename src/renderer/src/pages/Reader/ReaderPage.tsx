import { useEffect, useRef, useState } from 'react'
import type { Book, ReadingProgress } from '@shared/types'
import { createEpubEngine } from '../../components/reader/EpubEngine'
import { createTxtEngine } from '../../components/reader/TxtEngine'
import type { ReaderEngine } from '../../components/reader/engine'
import type { IndexedTocEntry } from '../../lib/readerProgress'
import { createProgressSaver, type ProgressSaver } from '../../lib/progressSaver'
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
  const saverRef = useRef<ProgressSaver | null>(null)
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

    const saver = createProgressSaver(window.api, b.id)
    saverRef.current = saver

    // 两种格式共用同一套界面与进度逻辑，差异全部封在引擎里（§5.7）
    const isEpub = b.format === 'epub'
    const engine = (isEpub ? createEpubEngine : createTxtEngine)({
      container,
      // 只有 EPUB 需要位置索引；TXT 的进度直接由字符偏移算出。
      // 传 undefined 而不是空函数 —— 让「谁需要它」这件事在调用点就看得出来
      loadLocations: isEpub ? () => window.api.getLocations(b.id) : undefined,
      saveLocations: isEpub ? (json) => window.api.saveLocations(b.id, json) : undefined,
      callbacks: {
        onRelocated(p) {
          setPercentage(p.percentage)
          setExact(p.percentageExact)
          setChapterIndex(p.chapterIndex)
          setChapterTitle(p.chapterTitle)
          saver.push(p)
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
    const onBeforeUnload = (): void => {
      // 尽力而为：异步 IPC 在 beforeunload 里不保证送达，真正的兜底是
      // 1 秒的防抖窗口（技术方案 §5.5）
      void saver.flush()
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('beforeunload', onBeforeUnload)
      void saver.flush()
      saver.dispose()
      engine.destroy()
      engineRef.current = null
      saverRef.current = null
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

  /** 先把进度落盘再退出，否则回到书架时角标与排序还是旧的 */
  const handleBack = async (): Promise<void> => {
    await saverRef.current?.flush()
    onBack()
  }

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
        onBack={() => void handleBack()}
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
