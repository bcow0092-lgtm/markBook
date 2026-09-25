// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ClickZones } from '../../src/renderer/src/components/reader/ClickZones'
import { ProgressBar } from '../../src/renderer/src/components/reader/ProgressBar'
import { TocPanel } from '../../src/renderer/src/components/reader/TocPanel'

afterEach(cleanup)

describe('ClickZones', () => {
  it('左中右三区各自触发对应回调', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    const onToggle = vi.fn()
    render(<ClickZones onPrev={onPrev} onNext={onNext} onToggleControls={onToggle} />)

    fireEvent.click(screen.getByTestId('zone-prev'))
    fireEvent.click(screen.getByTestId('zone-next'))
    fireEvent.click(screen.getByTestId('zone-toggle'))

    expect(onPrev).toHaveBeenCalledOnce()
    expect(onNext).toHaveBeenCalledOnce()
    expect(onToggle).toHaveBeenCalledOnce()
  })
})

describe('ProgressBar', () => {
  const geometry = {
    left: 0,
    width: 100,
    top: 0,
    height: 8,
    right: 100,
    bottom: 8,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect

  it('拖动过程中只回调预览，不提交', () => {
    const onPreview = vi.fn()
    const onCommit = vi.fn()
    render(<ProgressBar value={0.2} onPreview={onPreview} onCommit={onCommit} />)

    const bar = screen.getByTestId('progress-bar')
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(geometry)

    fireEvent.pointerDown(bar, { clientX: 10 })
    fireEvent.pointerMove(bar, { clientX: 60 })

    expect(onPreview).toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.pointerUp(bar, { clientX: 60 })

    expect(onCommit).toHaveBeenCalledOnce()
    expect(onCommit).toHaveBeenCalledWith(0.6)
  })

  it('显示百分比，估算值带 ~ 前缀', () => {
    const { rerender } = render(
      <ProgressBar value={0.35} exact onPreview={vi.fn()} onCommit={vi.fn()} />,
    )
    expect(screen.getByTestId('progress-label')).toHaveTextContent('35%')

    rerender(<ProgressBar value={0.35} exact={false} onPreview={vi.fn()} onCommit={vi.fn()} />)
    expect(screen.getByTestId('progress-label')).toHaveTextContent('~35%')
  })

  it('不拖动时按传入值显示，拖动中跟随预览', () => {
    const { rerender } = render(
      <ProgressBar value={0.1} onPreview={vi.fn()} onCommit={vi.fn()} />,
    )
    expect(screen.getByTestId('progress-label')).toHaveTextContent('10%')

    const bar = screen.getByTestId('progress-bar')
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(geometry)
    fireEvent.pointerDown(bar, { clientX: 80 })
    expect(screen.getByTestId('progress-label')).toHaveTextContent('80%')

    rerender(<ProgressBar value={0.1} onPreview={vi.fn()} onCommit={vi.fn()} />)
    expect(screen.getByTestId('progress-label')).toHaveTextContent('80%')
  })
})

describe('TocPanel', () => {
  const entries = [
    { title: '第一章', spineIndex: 0 },
    { title: '第二章', spineIndex: 3 },
  ]

  it('渲染全部目录项', () => {
    render(<TocPanel entries={entries} currentIndex={0} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('第一章')).toBeInTheDocument()
    expect(screen.getByText('第二章')).toBeInTheDocument()
  })

  it('高亮当前章节', () => {
    render(<TocPanel entries={entries} currentIndex={1} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('第二章').closest('button')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('第一章').closest('button')).not.toHaveAttribute('aria-current')
  })

  it('点击某章触发 onSelect 并带上它的下标', () => {
    const onSelect = vi.fn()
    render(<TocPanel entries={entries} currentIndex={0} onSelect={onSelect} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('第二章'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('没有目录时给出提示而不是空白', () => {
    render(<TocPanel entries={[]} currentIndex={-1} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/没有目录/)).toBeInTheDocument()
  })
})
