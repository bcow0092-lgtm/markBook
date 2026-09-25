import { describe, it, expect, vi } from 'vitest'
import { createSettingsSaver } from '../../src/renderer/src/store/settings'
import { makeApi } from './makeApi'
import { DEFAULT_READER_SETTINGS } from '@shared/types'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('createSettingsSaver', () => {
  it('防抖窗口内连续 push 只写一次，落的是最后一次', async () => {
    const api = makeApi()
    const saver = createSettingsSaver(api, { debounceMs: 10_000 })

    saver.push({ ...DEFAULT_READER_SETTINGS, fontSize: 16 })
    saver.push({ ...DEFAULT_READER_SETTINGS, fontSize: 20 })
    saver.push({ ...DEFAULT_READER_SETTINGS, fontSize: 24 })
    expect(api.saveSettings).not.toHaveBeenCalled()

    await saver.flush()

    expect(api.saveSettings).toHaveBeenCalledOnce()
    expect(vi.mocked(api.saveSettings).mock.calls[0][0]).toEqual({
      ...DEFAULT_READER_SETTINGS,
      fontSize: 24,
    })
  })

  it('窗口结束后自动写一次', async () => {
    const api = makeApi()
    const saver = createSettingsSaver(api, { debounceMs: 20 })
    saver.push({ ...DEFAULT_READER_SETTINGS, fontSize: 16 })
    await sleep(150)
    expect(api.saveSettings).toHaveBeenCalledOnce()
  })

  it('没有改动时 flush 不写盘', async () => {
    const api = makeApi()
    const saver = createSettingsSaver(api, { debounceMs: 10_000 })
    await saver.flush()
    expect(api.saveSettings).not.toHaveBeenCalled()
  })

  it('写盘失败不抛出', async () => {
    const api = makeApi({
      saveSettings: vi.fn(async () => {
        throw new Error('磁盘满了')
      }),
    })
    const saver = createSettingsSaver(api, { debounceMs: 10_000 })
    saver.push({ ...DEFAULT_READER_SETTINGS, fontSize: 16 })
    await expect(saver.flush()).resolves.toBeUndefined()
  })
})
