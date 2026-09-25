import { describe, it, expect } from 'vitest'
import {
  FONT_SIZES,
  LINE_HEIGHTS,
  PAGE_MARGIN_PX,
  nearestStep,
  stepValue,
} from '../../src/renderer/src/lib/readerSettings'

describe('档位表', () => {
  it('字号从小到大且都为正', () => {
    expect(FONT_SIZES.length).toBeGreaterThan(1)
    for (let i = 1; i < FONT_SIZES.length; i++) {
      expect(FONT_SIZES[i]).toBeGreaterThan(FONT_SIZES[i - 1])
    }
  })

  it('行距从小到大', () => {
    for (let i = 1; i < LINE_HEIGHTS.length; i++) {
      expect(LINE_HEIGHTS[i]).toBeGreaterThan(LINE_HEIGHTS[i - 1])
    }
  })

  it('默认值 18 / 1.8 都在档位表里', () => {
    expect(FONT_SIZES).toContain(18)
    expect(LINE_HEIGHTS).toContain(1.8)
  })

  it('页边距三档，且窄 < 适中 < 宽', () => {
    expect(PAGE_MARGIN_PX.narrow).toBeLessThan(PAGE_MARGIN_PX.medium)
    expect(PAGE_MARGIN_PX.medium).toBeLessThan(PAGE_MARGIN_PX.wide)
  })
})

describe('nearestStep', () => {
  const steps = [10, 20, 30] as const

  it('正好在档位上时返回它自己', () => {
    expect(nearestStep(steps, 20)).toBe(20)
  })

  it('落在两档之间时吸附到最近的', () => {
    expect(nearestStep(steps, 16)).toBe(20)
    expect(nearestStep(steps, 14)).toBe(10)
  })

  it('低于最低档时吸附到最低档', () => {
    expect(nearestStep(steps, -100)).toBe(10)
  })

  it('高于最高档时吸附到最高档', () => {
    expect(nearestStep(steps, 999)).toBe(30)
  })

  it('空档位表返回原值，不抛异常', () => {
    expect(nearestStep([], 42)).toBe(42)
  })
})

describe('stepValue', () => {
  const steps = [10, 20, 30] as const

  it('向前挪一格', () => {
    expect(stepValue(steps, 20, 1)).toBe(30)
  })

  it('向后挪一格', () => {
    expect(stepValue(steps, 20, -1)).toBe(10)
  })

  it('到端点时不越界、也不循环', () => {
    expect(stepValue(steps, 30, 1)).toBe(30)
    expect(stepValue(steps, 10, -1)).toBe(10)
  })

  it('当前值不在档位上时先吸附再挪', () => {
    // 17 吸附到 20，再往前一格是 30
    expect(stepValue(steps, 17, 1)).toBe(30)
  })

  it('空档位表返回原值', () => {
    expect(stepValue([], 42, 1)).toBe(42)
  })

  it('delta 为 0 时只做吸附', () => {
    expect(stepValue(steps, 17, 0)).toBe(20)
  })
})
