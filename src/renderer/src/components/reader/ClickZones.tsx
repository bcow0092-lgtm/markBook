interface Props {
  onPrev(): void
  onNext(): void
  onToggleControls(): void
}

/**
 * 左 1/3 上一页、右 1/3 下一页、中间 1/3 切换控件显隐（§11.2）。
 *
 * 三个区都绝对定位铺满。外层容器刻意不设 `pointer-events-none` —— 设了
 * 之后子元素必须显式加回 `pointer-events-auto` 才能点，很容易漏掉而让
 * 整个阅读页点不动。用固定百分比宽度而不是把判断写进一个 onClick，是
 * 为了让每个区都能被单独测到。
 */
export function ClickZones({ onPrev, onNext, onToggleControls }: Props) {
  const base = 'absolute inset-y-0 cursor-pointer'
  return (
    <>
      <button
        type="button"
        data-testid="zone-prev"
        aria-label="上一页"
        onClick={onPrev}
        className={`${base} left-0 w-1/3`}
      />
      <button
        type="button"
        data-testid="zone-toggle"
        aria-label="显示或隐藏工具栏"
        onClick={onToggleControls}
        className={`${base} left-1/3 w-1/3`}
      />
      <button
        type="button"
        data-testid="zone-next"
        aria-label="下一页"
        onClick={onNext}
        className={`${base} left-2/3 w-1/3`}
      />
    </>
  )
}
