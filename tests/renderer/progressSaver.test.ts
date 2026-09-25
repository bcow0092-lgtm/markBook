import { describe, it, expect, vi } from 'vitest'
import { createProgressSaver } from '../../src/renderer/src/lib/progressSaver'
import { makeApi } from './makeApi'
import type { ReadingProgress } from '@shared/types'

const progress = (pct: number): ReadingProgress => ({
  location: `cfi-${pct}`,
  percentage: pct,
  percentageExact: true,
  chapterIndex: 0,
  chapterTitle: '第一章',
})

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('createProgressSaver', () => {
  it('防抖窗口内的连续 push 只落盘一次，且落的是最后一次', async () => {
    const api = makeApi()
    const saver = createProgressSaver(api, 'id1', { debounceMs: 10_000 })

    saver.push(progress(0.1))
    saver.push(progress(0.2))
    saver.push(progress(0.3))
    expect(api.saveProgress).not.toHaveBeenCalled()

    await saver.flush()

    expect(api.saveProgress).toHaveBeenCalledOnce()
    expect(vi.mocked(api.saveProgress).mock.calls[0]).toEqual(['id1', progress(0.3)])
  })

  it('窗口结束后自动落盘一次', async () => {
    const api = makeApi()
    const saver = createProgressSaver(api, 'id1', { debounceMs: 20 })

    saver.push(progress(0.5))
    await sleep(150)

    expect(api.saveProgress).toHaveBeenCalledOnce()
  })

  it('没有新进度时 flush 不写盘', async () => {
    const api = makeApi()
    const saver = createProgressSaver(api, 'id1', { debounceMs: 10_000 })
    await saver.flush()
    expect(api.saveProgress).not.toHaveBeenCalled()
  })

  it('flush 之后已落盘的内容不会重复写', async () => {
    const api = makeApi()
    const saver = createProgressSaver(api, 'id1', { debounceMs: 10_000 })
    saver.push(progress(0.1))
    await saver.flush()
    await saver.flush()
    expect(api.saveProgress).toHaveBeenCalledOnce()
  })

  it('flush 会取消待触发的定时器，之后不再自动写第二次', async () => {
    const api = makeApi()
    const saver = createProgressSaver(api, 'id1', { debounceMs: 20 })
    saver.push(progress(0.1))
    await saver.flush()
    await sleep(120)
    expect(api.saveProgress).toHaveBeenCalledOnce()
  })

  it('push 不返回 promise —— 高频的 relocated 不该等写盘', () => {
    const api = makeApi()
    const saver = createProgressSaver(api, 'id1')
    expect(saver.push(progress(0.1))).toBeUndefined()
  })

  it('落盘失败不抛出，阅读不因此中断', async () => {
    const api = makeApi({
      saveProgress: vi.fn(async () => {
        throw new Error('磁盘满了')
      }),
    })
    const saver = createProgressSaver(api, 'id1', { debounceMs: 10_000 })
    saver.push(progress(0.1))
    await expect(saver.flush()).resolves.toBeUndefined()
  })
})
