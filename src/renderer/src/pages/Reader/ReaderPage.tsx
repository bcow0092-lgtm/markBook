import { useEffect, useRef, useState } from 'react'
import type { Book, ReadingProgress } from '@shared/types'
import { createEpubEngine } from '../../components/reader/EpubEngine'
import { createTxtEngine } from '../../components/reader/TxtEngine'
import type { ReaderEngine } from '../../components/reader/engine'
import type { IndexedTocEntry } from '../../lib/readerProgress'
import { createProgressSaver, type ProgressSaver } from '../../lib/progressSaver'
import { createSettingsSaver, useSettingsStore } from '../../store/settings'
import { ClickZones } from '../../components/reader/ClickZones'
import { ProgressBar } from '../../components/reader/ProgressBar'
import { SettingsPanel } from '../../components/reader/SettingsPanel'
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const settings = useSettingsStore((s) => s.settings)
  const loadSettings = useSettingsStore((s) => s.load)
  const setSettings = useSettingsStore((s) => s.set)
  const settingsSaverRef = useRef(createSettingsSaver(window.api))

  // 回调走 ref，effect 的依赖只留 book.id。
  //
  // 依赖里放 book 对象或 onProgress 函数都会出事：前者在每次书架 refresh 后
  // 都是新引用，后者是 App 里的内联箭头函数、每次渲染都变 —— 两者都会让
  // 下面的 effect 反复执行，引擎被销毁重建，正文无限重排。
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress
  const bookRef = useRef(book)
  bookRef.current = book

  // 设置也一样：进 load effect 的要用 ref，否则改字号会重建引擎
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  // 设置一变就应用。引擎的 applySettings 内部负责「存位置 → 应用 → 恢复」
  useEffect(() => {
    engineRef.current?.applySettings(settings)
  }, [settings])

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

    engine
      .load(b, b.progress?.location ?? null)
      // 书加载完再应用设置：此时引擎才有 rendition / columns 可写
      .then(() => engine.applySettings(settingsRef.current))
      .catch((err: unknown) => {
        console.error('[reader] 打开失败', err)
        setLoadError(err instanceof Error ? err.message : String(err))
      })

    const onResize = (): void => engine.resize()
    const onBeforeUnload = (): void => {
      // 尽力而为：异步 IPC 在 beforeunload 里不保证送达，真正的兜底是
      // 防抖窗口本身很短（进度 1s、设置 300ms）
      void saver.flush()
      void settingsSaverRef.current.flush()
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('beforeunload', onBeforeUnload)
      void saver.flush()
      void settingsSaverRef.current.flush()
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

  /** 先把进度与设置落盘再退出，否则回到书架时角标与排序还是旧的 */
  const handleBack = async (): Promise<void> => {
    await saverRef.current?.flush()
    await settingsSaverRef.current.flush()
    onBack()
  }

  /** 设置改动即时应用（用户要立刻看到反馈），写盘做防抖 */
  const handleSettingsChange = (next: typeof settings): void => {
    setSettings(next)
    settingsSaverRef.current.push(next)
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
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {controlsVisible && !settingsOpen && (
        <div className="absolute inset-x-0 bottom-0">
          <ProgressBar
            value={percentage}
            exact={exact}
            onPreview={setPercentage}
            onCommit={(p) => engineRef.current?.goToPercentage(p)}
          />
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {loadError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[var(--color-reader-bg)]">
          <p className="text-sm text-[var(--color-reader-text)]">这本书打不开</p>
          <p className="max-w-md text-center text-xs text-[var(--color-reader-muted)]">
            {loadError}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="cursor-pointer rounded bg-[var(--color-reader-accent)] px-4 py-2 text-sm text-white"
          >
            返回书架
          </button>
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
