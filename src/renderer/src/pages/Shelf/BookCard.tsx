import type { Book } from '@shared/types'

interface Props {
  book: Book
  onOpen(id: string): void
  onDelete(id: string): void
}

/** 缺封面时用书名首字作占位（技术方案 §11.1） */
function placeholderChar(title: string): string {
  return [...title.trim()][0] ?? '书'
}

/** 未读返回 null；估算值带 ~ 前缀（§5.5） */
function progressLabel(book: Book): string | null {
  if (!book.progress) return null
  const pct = Math.round(book.progress.percentage * 100)
  return `${book.progress.percentageExact ? '' : '~'}${pct}%`
}

export function BookCard({ book, onOpen, onDelete }: Props) {
  const label = progressLabel(book)

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onOpen(book.id)}
        className="block w-full cursor-pointer text-left"
        aria-label={`打开《${book.title}》`}
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded bg-neutral-200">
          {book.coverFileName ? (
            <img
              data-testid="cover"
              src={`app://local/covers/${book.coverFileName}`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl text-neutral-500">
              {placeholderChar(book.title)}
            </div>
          )}

          {label && (
            <span
              data-testid="progress-badge"
              className="absolute right-1 bottom-1 rounded bg-black/55 px-1.5 py-0.5 text-xs text-white"
            >
              {label}
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-[var(--color-reader-text)]">{book.title}</p>
        <p className="truncate text-xs text-[var(--color-reader-muted)]">
          {book.author || '未知作者'}
        </p>
      </button>

      <button
        type="button"
        onClick={() => onDelete(book.id)}
        aria-label={`删除《${book.title}》`}
        className="absolute top-1 right-1 hidden cursor-pointer rounded bg-black/55 px-1.5 py-0.5 text-xs text-white group-hover:block"
      >
        删除
      </button>
    </div>
  )
}
