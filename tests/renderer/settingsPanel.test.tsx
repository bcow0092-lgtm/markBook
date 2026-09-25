// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SettingsPanel } from '../../src/renderer/src/components/reader/SettingsPanel'
import type { ReaderSettings } from '@shared/types'

afterEach(cleanup)

const settings: ReaderSettings = { fontSize: 18, lineHeight: 1.8, pageMargin: 'medium' }

describe('SettingsPanel', () => {
  it('显示当前字号与行距', () => {
    render(<SettingsPanel settings={settings} onChange={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByTestId('font-size-value')).toHaveTextContent('18')
    expect(screen.getByTestId('line-height-value')).toHaveTextContent('1.8')
  })

  it('点字号加号发出调大后的设置', () => {
    const onChange = vi.fn()
    render(<SettingsPanel settings={settings} onChange={onChange} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('增大字号'))
    expect(onChange).toHaveBeenCalledWith({ ...settings, fontSize: 20 })
  })

  it('点字号减号发出调小后的设置', () => {
    const onChange = vi.fn()
    render(<SettingsPanel settings={settings} onChange={onChange} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('减小字号'))
    expect(onChange).toHaveBeenCalledWith({ ...settings, fontSize: 16 })
  })

  it('字号已在最大档时加号禁用', () => {
    render(
      <SettingsPanel
        settings={{ ...settings, fontSize: 28 }}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('增大字号')).toBeDisabled()
  })

  it('字号已在最小档时减号禁用', () => {
    render(
      <SettingsPanel
        settings={{ ...settings, fontSize: 14 }}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('减小字号')).toBeDisabled()
  })

  it('点行距加号发出调大后的设置', () => {
    const onChange = vi.fn()
    render(<SettingsPanel settings={settings} onChange={onChange} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('增大行距'))
    expect(onChange).toHaveBeenCalledWith({ ...settings, lineHeight: 2 })
  })

  it('点页边距三档各自发出对应值', () => {
    const onChange = vi.fn()
    render(<SettingsPanel settings={settings} onChange={onChange} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '窄' }))
    expect(onChange).toHaveBeenCalledWith({ ...settings, pageMargin: 'narrow' })
    fireEvent.click(screen.getByRole('button', { name: '宽' }))
    expect(onChange).toHaveBeenCalledWith({ ...settings, pageMargin: 'wide' })
  })

  it('当前页边距档位有 aria-pressed', () => {
    render(<SettingsPanel settings={settings} onChange={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '适中' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '窄' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('点关闭触发 onClose', () => {
    const onClose = vi.fn()
    render(<SettingsPanel settings={settings} onChange={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('关闭设置'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
