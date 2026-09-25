import { useRef, useState } from 'react'

interface Props {
  /** 0 ~ 1 */
  value: number
  /** 百分比是否为精确值；false 时显示 ~ 前缀 */
  exact?: boolean
  onPreview(percentage: number): void
  onCommit(percentage: number): void
}

function pctLabel(value: number, exact: boolean): string {
  return `${exact ? '' : '~'}${Math.round(value * 100)}%`
}

/**
 * 可拖拽的底部进度条（§11.2）。
 *
 * 拖动过程只回调 onPreview、松手才 onCommit —— 连续 display() 会把渲染打爆，
 * 而且位置索引未就绪时每次跳转都要重新分页。
 */
export function ProgressBar({ value, exact = true, onPreview, onCommit }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)

  const ratioAt = (clientX: number): number => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  /** jsdom 没有 pointer capture，真实环境里它保证拖出元素后仍能收到 move */
  const capture = (el: HTMLElement, pointerId: number | undefined): void => {
    if (pointerId === undefined) return
    try {
      el.setPointerCapture(pointerId)
    } catch {
      // 不支持时忽略：没有 capture 只是拖出边界后丢事件，不影响主流程
    }
  }

  const shown = preview ?? value

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div
        ref={ref}
        data-testid="progress-bar"
        role="slider"
        aria-label="阅读进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shown * 100)}
        className="relative h-2 flex-1 cursor-pointer rounded bg-neutral-300"
        onPointerDown={(e) => {
          capture(e.currentTarget, e.pointerId)
          const r = ratioAt(e.clientX)
          setDragging(true)
          setPreview(r)
          onPreview(r)
        }}
        onPointerMove={(e) => {
          if (!dragging) return
          const r = ratioAt(e.clientX)
          setPreview(r)
          onPreview(r)
        }}
        onPointerUp={(e) => {
          if (!dragging) return
          const r = ratioAt(e.clientX)
          setDragging(false)
          setPreview(null)
          onCommit(r)
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded bg-[var(--color-reader-accent)]"
          style={{ width: `${shown * 100}%` }}
        />
      </div>
      <span
        data-testid="progress-label"
        className="w-12 text-right text-xs text-[var(--color-reader-muted)]"
      >
        {pctLabel(shown, exact)}
      </span>
    </div>
  )
}
