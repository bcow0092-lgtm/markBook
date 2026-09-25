interface Props {
  visible: boolean
  chapterTitle: string
  onBack(): void
  onOpenToc(): void
}

/**
 * 顶部工具栏（§11.2）：返回 / 章节名 / 设置。
 *
 * 设置按钮是 M5 的活，这里先不放 —— 放了点不动比没有更糟。
 * 隐藏时用 `pointer-events-none`，否则一条透明的工具栏会挡住中间热区。
 */
export function ReaderToolbar({ visible, chapterTitle, onBack, onOpenToc }: Props) {
  return (
    <div
      className={`absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-white/95 px-4 py-3 backdrop-blur transition-opacity ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <button type="button" onClick={onBack} className="cursor-pointer text-sm">
        返回
      </button>
      <button
        type="button"
        onClick={onOpenToc}
        className="flex-1 cursor-pointer truncate text-center text-sm text-[var(--color-reader-muted)]"
      >
        {chapterTitle || '目录'}
      </button>
      <span className="w-10" aria-hidden="true" />
    </div>
  )
}
