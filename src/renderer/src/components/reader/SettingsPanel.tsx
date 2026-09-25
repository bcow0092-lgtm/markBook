import type { ReaderSettings } from '@shared/types'
import { FONT_SIZES, LINE_HEIGHTS, stepValue } from '../../lib/readerSettings'

interface Props {
  settings: ReaderSettings
  onChange(next: ReaderSettings): void
  onClose(): void
}

const MARGIN_LABELS = [
  ['narrow', '窄'],
  ['medium', '适中'],
  ['wide', '宽'],
] as const

const BTN =
  'flex h-8 w-8 cursor-pointer items-center justify-center rounded border text-sm disabled:cursor-default disabled:opacity-30'

interface StepperProps {
  label: string
  display: string
  /** 供测试定位用；不与 label 混用，免得文案改了就找不到元素 */
  testId: string
  onStep(delta: number): void
  canDown: boolean
  canUp: boolean
}

function Stepper({ label, display, testId, onStep, canDown, canUp }: StepperProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[var(--color-reader-text)]">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`减小${label}`}
          disabled={!canDown}
          onClick={() => onStep(-1)}
          className={BTN}
        >
          −
        </button>
        <span data-testid={testId} className="w-10 text-center text-sm">
          {display}
        </span>
        <button
          type="button"
          aria-label={`增大${label}`}
          disabled={!canUp}
          onClick={() => onStep(1)}
          className={BTN}
        >
          ＋
        </button>
      </div>
    </div>
  )
}

/** 底部滑出的阅读设置面板（§11.3）：字号 / 行距 / 页边距三组 */
export function SettingsPanel({ settings, onChange, onClose }: Props) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-lg bg-white px-5 pt-3 pb-5 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-reader-text)]">阅读设置</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭设置"
          className="cursor-pointer text-sm text-[var(--color-reader-muted)]"
        >
          关闭
        </button>
      </div>

      <Stepper
        label="字号"
        testId="font-size-value"
        display={String(settings.fontSize)}
        canDown={settings.fontSize > FONT_SIZES[0]}
        canUp={settings.fontSize < FONT_SIZES[FONT_SIZES.length - 1]}
        onStep={(d) =>
          onChange({ ...settings, fontSize: stepValue(FONT_SIZES, settings.fontSize, d) })
        }
      />

      <Stepper
        label="行距"
        testId="line-height-value"
        display={settings.lineHeight.toFixed(1)}
        canDown={settings.lineHeight > LINE_HEIGHTS[0]}
        canUp={settings.lineHeight < LINE_HEIGHTS[LINE_HEIGHTS.length - 1]}
        onStep={(d) =>
          onChange({ ...settings, lineHeight: stepValue(LINE_HEIGHTS, settings.lineHeight, d) })
        }
      />

      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-[var(--color-reader-text)]">页边距</span>
        <div className="flex gap-2">
          {MARGIN_LABELS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={settings.pageMargin === key}
              onClick={() => onChange({ ...settings, pageMargin: key })}
              className={`cursor-pointer rounded border px-3 py-1 text-sm ${
                settings.pageMargin === key
                  ? 'border-[var(--color-reader-accent)] text-[var(--color-reader-accent)]'
                  : 'text-[var(--color-reader-text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
