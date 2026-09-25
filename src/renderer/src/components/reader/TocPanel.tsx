import type { IndexedTocEntry } from '../../lib/readerProgress'

interface Props {
  entries: IndexedTocEntry[]
  /** 当前章节在 entries 里的下标；-1 表示没定位到 */
  currentIndex: number
  onSelect(index: number): void
  onClose(): void
}

export function TocPanel({ entries, currentIndex, onSelect, onClose }: Props) {
  return (
    <div className="absolute inset-y-0 left-0 z-20 flex w-72 flex-col bg-white shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-medium text-[var(--color-reader-text)]">目录</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭目录"
          className="cursor-pointer text-sm text-[var(--color-reader-muted)]"
        >
          关闭
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--color-reader-muted)]">这本书没有目录</p>
        ) : (
          entries.map((entry, i) => (
            <button
              key={`${entry.spineIndex}-${i}`}
              type="button"
              aria-current={i === currentIndex ? 'true' : undefined}
              onClick={() => onSelect(i)}
              className={`block w-full cursor-pointer truncate px-4 py-2 text-left text-sm ${
                i === currentIndex
                  ? 'font-medium text-[var(--color-reader-accent)]'
                  : 'text-[var(--color-reader-text)] hover:bg-neutral-100'
              }`}
            >
              {entry.title || '（无标题）'}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
