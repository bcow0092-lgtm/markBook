/**
 * 阅读设置的档位表与步进。
 *
 * 用离散档位而不是连续值：取值可预测、不会调出 17.3px 这种值、设置能
 * 幂等地重现。三组设置的档位定义在这里，UI 与生效逻辑都从这里取。
 */

/** 字号档位（px）。默认 18 在表内 */
export const FONT_SIZES = [14, 16, 18, 20, 22, 24, 28] as const

/** 行距档位（倍数）。默认 1.8 在表内 */
export const LINE_HEIGHTS = [1.4, 1.6, 1.8, 2.0, 2.2] as const

/** 页边距三档（px），语义对齐微信读书的「页边距」（§5.3） */
export const PAGE_MARGIN_PX = { narrow: 24, medium: 56, wide: 96 } as const

/** 把任意值吸附到档位表里最近的一档。空表时原样返回 */
export function nearestStep(steps: readonly number[], value: number): number {
  if (steps.length === 0) return value
  return steps.reduce((best, cur) => (Math.abs(cur - value) < Math.abs(best - value) ? cur : best))
}

/**
 * 在档位表里前后挪 delta 格。
 *
 * 先吸附再挪 —— 当前值不在档位上时（比如旧设置留下的值），不先吸附会算错
 * 位置。到端点时停在端点，不循环：字号从最大跳回最小会让人措手不及。
 */
export function stepValue(steps: readonly number[], value: number, delta: number): number {
  if (steps.length === 0) return value
  const index = steps.indexOf(nearestStep(steps, value))
  const next = Math.min(steps.length - 1, Math.max(0, index + delta))
  return steps[next]
}
